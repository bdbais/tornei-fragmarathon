/* Tornei Fragmarathon: fogli di calcolo per l'elenco dei giocatori.
   Legge .xlsx (Excel, Google Sheets scaricato), .csv e .tsv; scrive .xlsx e .csv.
   Niente librerie: lo .xlsx è uno zip di file XML. Per leggere si usa DecompressionStream("deflate-raw"),
   per scrivere uno zip senza compressione (formato "stored"), che Excel e Google Sheets aprono senza problemi. */
(function () {
  "use strict";
  /* ---------- CSV ---------- */
  function parseCsv(text) {
    text = String(text || "").replace(/^﻿/, "");
    var first = text.split(/\r?\n/)[0] || "", sep = [["\t", 0], [";", 0], [",", 0]].map(function (s) { s[1] = first.split(s[0]).length; return s; }).sort(function (a, b) { return b[1] - a[1]; })[0][0];
    var rows = [], row = [], cell = "", q = false;
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; continue; }
      if (c === '"' && cell === "") q = true;
      else if (c === sep) { row.push(cell); cell = ""; }
      else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
      else cell += c;
    }
    if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
    return rows.map(function (r) { return r.map(function (x) { return x.trim(); }); }).filter(function (r) { return r.some(Boolean); });
  }
  function toCsv(rows) {
    /* punto e virgola: è il separatore che Excel in italiano apre direttamente; il BOM fa riconoscere l'UTF-8 */
    return "﻿" + rows.map(function (r) { return r.map(function (x) { x = String(x == null ? "" : x); return /[";\n\r,]/.test(x) ? '"' + x.replace(/"/g, '""') + '"' : x; }).join(";"); }).join("\r\n");
  }

  /* ---------- ZIP ---------- */
  var CRC = (function () { var t = new Uint32Array(256); for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(u) { var c = 0xFFFFFFFF; for (var i = 0; i < u.length; i++) c = CRC[(c ^ u[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  function zipStore(files) {
    var enc = new TextEncoder(), parts = [], central = [], off = 0;
    files.forEach(function (f) {
      var name = enc.encode(f.name), data = typeof f.data === "string" ? enc.encode(f.data) : f.data, crc = crc32(data);
      var h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
      h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, name.length, true);
      parts.push(new Uint8Array(h.buffer), name, data);
      var c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true);
      c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, name.length, true); c.setUint32(42, off, true);
      central.push(new Uint8Array(c.buffer), name);
      off += 30 + name.length + data.length;
    });
    var csize = central.reduce(function (n, p) { return n + p.length; }, 0), e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, csize, true); e.setUint32(16, off, true);
    return new Blob(parts.concat(central, [new Uint8Array(e.buffer)]), { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  }
  function unzip(buf) {
    var u = new Uint8Array(buf), v = new DataView(buf), dec = new TextDecoder(), eocd = -1;
    for (var i = u.length - 22; i >= Math.max(0, u.length - 65557); i--) if (v.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) return Promise.reject(new Error("non è un file .xlsx valido"));
    var n = v.getUint16(eocd + 10, true), p = v.getUint32(eocd + 16, true), out = {}, jobs = [];
    for (var k = 0; k < n; k++) {
      if (v.getUint32(p, true) !== 0x02014b50) break;
      var method = v.getUint16(p + 10, true), csz = v.getUint32(p + 20, true), nl = v.getUint16(p + 28, true), xl = v.getUint16(p + 30, true), cl = v.getUint16(p + 32, true), lo = v.getUint32(p + 42, true);
      var name = dec.decode(u.subarray(p + 46, p + 46 + nl));
      var ds = lo + 30 + v.getUint16(lo + 26, true) + v.getUint16(lo + 28, true), data = u.subarray(ds, ds + csz);
      if (/\.xml$/.test(name)) jobs.push((function (name, method, data) {
        var pr = method === 0 ? Promise.resolve(data) : new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).arrayBuffer().then(function (b) { return new Uint8Array(b); });
        return pr.then(function (d) { out[name] = dec.decode(d); });
      })(name, method, data));
      p += 46 + nl + xl + cl;
    }
    return Promise.all(jobs).then(function () { return out; });
  }

  /* ---------- XLSX ---------- */
  function xesc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ""); }
  function colName(i) { var s = ""; i++; while (i) { var m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }
  function toXlsx(rows, sheetName) {
    var sd = rows.map(function (r, ri) {
      return '<row r="' + (ri + 1) + '">' + r.map(function (x, ci) {
        var ref = colName(ci) + (ri + 1);
        return typeof x === "number" ? '<c r="' + ref + '"><v>' + x + "</v></c>" : '<c r="' + ref + '" t="inlineStr"' + (ri === 0 ? ' s="1"' : "") + "><is><t xml:space=\"preserve\">" + xesc(x == null ? "" : x) + "</t></is></c>";
      }).join("") + "</row>";
    }).join("");
    var W = rows.reduce(function (m, r) { r.forEach(function (x, i) { m[i] = Math.max(m[i] || 8, Math.min(60, String(x == null ? "" : x).length + 2)); }); return m; }, []);
    return zipStore([
      { name: "[Content_Types].xml", data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>' },
      { name: "_rels/.rels", data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
      { name: "xl/workbook.xml", data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="' + xesc(String(sheetName || "Giocatori").slice(0, 31).replace(/[\\/?*[\]:]/g, " ")) + '" sheetId="1" r:id="rId1"/></sheets></workbook>' },
      { name: "xl/_rels/workbook.xml.rels", data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' },
      { name: "xl/styles.xml", data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="2"><xf fontId="0"/><xf fontId="1" applyFont="1"/></cellXfs></styleSheet>' },
      { name: "xl/worksheets/sheet1.xml", data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>' + W.map(function (w, i) { return '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>'; }).join("") + "</cols><sheetData>" + sd + "</sheetData></worksheet>" }
    ]);
  }
  function readXlsx(buf) {
    return unzip(buf).then(function (f) {
      var P = new DOMParser(), ss = [];
      if (f["xl/sharedStrings.xml"]) {
        var sd = P.parseFromString(f["xl/sharedStrings.xml"], "application/xml");
        Array.prototype.forEach.call(sd.getElementsByTagName("si"), function (si) { ss.push(Array.prototype.map.call(si.getElementsByTagName("t"), function (t) { return t.textContent; }).join("")); });
      }
      /* primo foglio: quello indicato da workbook.xml, se no sheet1 */
      var name = Object.keys(f).filter(function (k) { return /^xl\/worksheets\/sheet\d+\.xml$/.test(k); }).sort()[0];
      if (!name) throw new Error("nessun foglio nel file");
      var doc = P.parseFromString(f[name], "application/xml"), rows = [];
      Array.prototype.forEach.call(doc.getElementsByTagName("row"), function (r) {
        var row = [];
        Array.prototype.forEach.call(r.getElementsByTagName("c"), function (c) {
          var ref = c.getAttribute("r") || "", m = /^([A-Z]+)/.exec(ref), col = 0;
          if (m) for (var i = 0; i < m[1].length; i++) col = col * 26 + (m[1].charCodeAt(i) - 64);
          col = col ? col - 1 : row.length;
          var t = c.getAttribute("t"), v = c.getElementsByTagName("v")[0], val = "";
          if (t === "s" && v) val = ss[+v.textContent] || "";
          else if (t === "inlineStr") val = Array.prototype.map.call(c.getElementsByTagName("t"), function (x) { return x.textContent; }).join("");
          else if (v) val = v.textContent;
          row[col] = String(val).trim();
        });
        for (var j = 0; j < row.length; j++) if (row[j] == null) row[j] = "";
        if (row.some(Boolean)) rows.push(row);
      });
      return rows;
    });
  }
  function readFile(file) {
    if (/\.xlsx$/i.test(file.name)) return file.arrayBuffer().then(readXlsx);
    if (/\.xls$/i.test(file.name)) return Promise.reject(new Error("il vecchio formato .xls non è supportato: salvalo come .xlsx o .csv"));
    return file.text().then(parseCsv);
  }
  /* link di Google Sheets -> indirizzo dell'esportazione CSV del foglio (serve "chiunque abbia il link") */
  function gsheetCsvUrl(link) {
    var m = /docs\.google\.com\/spreadsheets\/d\/([\w-]{20,})/.exec(String(link || "")); if (!m) return "";
    var g = /[#&?]gid=(\d+)/.exec(link);
    return "https://docs.google.com/spreadsheets/d/" + m[1] + "/export?format=csv" + (g ? "&gid=" + g[1] : "");
  }
  window.SHEETS = { parseCsv: parseCsv, toCsv: toCsv, toXlsx: toXlsx, readXlsx: readXlsx, readFile: readFile, gsheetCsvUrl: gsheetCsvUrl };
})();
