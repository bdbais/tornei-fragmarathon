/* Tornei Fragmarathon: fogli di calcolo per l'elenco dei giocatori.
   Legge .xlsx (Excel, Google Sheets scaricato), .csv e .tsv; scrive .xlsx e .csv.
   Niente librerie: lo .xlsx è uno zip di file XML. Per leggere si usa DecompressionStream("deflate-raw"),
   per scrivere uno zip senza compressione (formato "stored"), che Excel e Google Sheets aprono senza problemi. */
(function () {
  "use strict";
  /* ---------- CSV ---------- */
  /* separatore: si contano tab, ; e , sulla prima riga, fuori dalle virgolette. Un tab vince sempre
     (quello che si incolla da Excel o Sheets è separato da tab, e i nomi possono contenere virgole);
     se la prima riga non ne ha nessuno, la colonna è una sola e si usa il tab. */
  function detectSep(text) {
    var n = { "\t": 0, ";": 0, ",": 0 }, q = false;
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      /* come parseCsv: le virgolette aprono solo a inizio cella; "" dentro è una virgoletta */
      if (q) { if (c === '"') { if (text[i + 1] === '"') i++; else q = false; } continue; }
      if (c === '"' && (i === 0 || text[i - 1] in n)) q = true;
      else if (c === "\n" || c === "\r") break;
      else if (c in n) n[c]++;
    }
    return n["\t"] || !(n[";"] || n[","]) ? "\t" : n[";"] >= n[","] ? ";" : ",";
  }
  function parseCsv(text, forceSep) {
    text = String(text || "").replace(/^﻿/, "");
    var sep = forceSep || detectSep(text);
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
    /* l'apostrofo davanti a = + - @ lo mette csvCell contro le formule: rileggendo il file si toglie */
    return rows.map(function (r) { return r.map(function (x) { return x.trim().replace(/^'(?=[=+\-@\t\r])/, "").trim(); }); }).filter(function (r) { return r.some(Boolean); });
  }
  /* una cella che comincia con = + - @ (o tab, a capo) Excel la calcola come formula: un nome arrivato dal bot
     come =HYPERLINK(...) diventerebbe un link attivo. L'apostrofo davanti la fa leggere come testo; i numeri restano numeri.
     La cella protetta va anche tra virgolette, come raccomanda OWASP contro la CSV injection. */
  function csvCell(x) {
    var s = String(x == null ? "" : x), g = typeof x !== "number" && /^[=+\-@\t\r]/.test(s) && !/^[+-]?\d+(?:[.,]\d+)?$/.test(s);
    if (g) s = "'" + s;
    return g || /[";\n\r,\t]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function toCsv(rows) {
    /* punto e virgola: è il separatore che Excel in italiano apre direttamente; il BOM fa riconoscere l'UTF-8 */
    return "﻿" + rows.map(function (r) { return r.map(csvCell).join(";"); }).join("\r\n");
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
      if (/\.(xml|rels)$/.test(name)) jobs.push((function (name, method, data) {
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
  /* per nome locale: alcuni programmi scrivono <x:row>, <x:c>... con un prefisso */
  function tags(el, n) { return el.getElementsByTagNameNS("*", n); }
  /* testo di una cella: si saltano le letture fonetiche (<rPh>, i furigana di Excel in giapponese) */
  function rstText(el) { return Array.prototype.filter.call(tags(el, "t"), function (t) { return !t.parentNode || t.parentNode.localName !== "rPh"; }).map(function (t) { return t.textContent; }).join(""); }
  /* r:id del foglio, qualunque sia il prefisso del namespace */
  function relId(el) { for (var i = 0; i < el.attributes.length; i++) { var a = el.attributes[i]; if (a.localName === "id" && a.namespaceURI) return a.value; } return ""; }
  /* primo foglio di lavoro nell'ordine delle schede (workbook.xml e le sue relazioni), saltando quelli nascosti;
     se mancano, il foglio con il numero più basso */
  function firstSheet(f, P) {
    var wb = f["xl/workbook.xml"] && P.parseFromString(f["xl/workbook.xml"], "application/xml"), rl = f["xl/_rels/workbook.xml.rels"] && P.parseFromString(f["xl/_rels/workbook.xml.rels"], "application/xml"), T = {}, L = [];
    if (wb && rl) {
      Array.prototype.forEach.call(tags(rl, "Relationship"), function (r) {
        var t = r.getAttribute("Target") || "", o = [];
        (t.charAt(0) === "/" ? t.slice(1) : "xl/" + t).split("/").forEach(function (x) { if (x === "..") o.pop(); else if (x && x !== ".") o.push(x); });
        if (/\/worksheet$/.test(r.getAttribute("Type") || "")) T[r.getAttribute("Id")] = o.join("/");
      });
      Array.prototype.forEach.call(tags(wb, "sheet"), function (s) { var n = T[relId(s)]; if (n && f[n]) L.push({ n: n, h: /hidden/i.test(s.getAttribute("state") || "") }); });
    }
    var v = L.filter(function (x) { return !x.h; })[0] || L[0]; if (v) return v.n;
    var num = function (k) { return +(/(\d+)\.xml$/.exec(k) || [0, 0])[1]; };
    return Object.keys(f).filter(function (k) { return /^xl\/worksheets\/sheet\d*\.xml$/.test(k); }).sort(function (a, b) { return num(a) - num(b); })[0];
  }
  function readXlsx(buf) {
    return unzip(buf).then(function (f) {
      var P = new DOMParser(), ss = [];
      if (f["xl/sharedStrings.xml"]) {
        var sd = P.parseFromString(f["xl/sharedStrings.xml"], "application/xml");
        Array.prototype.forEach.call(tags(sd, "si"), function (si) { ss.push(rstText(si)); });
      }
      var name = firstSheet(f, P);
      if (!name) throw new Error("nessun foglio nel file");
      var doc = P.parseFromString(f[name], "application/xml"), rows = [];
      Array.prototype.forEach.call(tags(doc, "row"), function (r) {
        var row = [];
        Array.prototype.forEach.call(tags(r, "c"), function (c) {
          var ref = c.getAttribute("r") || "", m = /^([A-Z]+)/.exec(ref), col = 0;
          if (m) for (var i = 0; i < m[1].length; i++) col = col * 26 + (m[1].charCodeAt(i) - 64);
          col = col ? col - 1 : row.length;
          var t = c.getAttribute("t"), v = tags(c, "v")[0], val = "";
          if (t === "s" && v) val = ss[+v.textContent] || "";
          else if (t === "inlineStr") val = rstText(c);
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
    /* Excel in italiano salva CSV e testo in ANSI (Windows-1252), "Testo Unicode" in UTF-16 con BOM:
       si prova l'UTF-8 (anche i file esportati da qui) e, se i byte non lo sono, Windows-1252 */
    return file.arrayBuffer().then(function (b) {
      var u = new Uint8Array(b), t;
      if (u[0] === 0xFF && u[1] === 0xFE) t = new TextDecoder("utf-16le").decode(u);
      else if (u[0] === 0xFE && u[1] === 0xFF) t = new TextDecoder("utf-16be").decode(u);
      else { try { t = new TextDecoder("utf-8", { fatal: true }).decode(u); } catch (e) { t = new TextDecoder("windows-1252").decode(u); } }
      return parseCsv(t);
    });
  }
  /* link di Google Sheets -> indirizzo dell'esportazione CSV del foglio (serve "chiunque abbia il link") */
  function gsheetCsvUrl(link) {
    var m = /docs\.google\.com\/spreadsheets\/d\/([\w-]{20,})/.exec(String(link || "")); if (!m) return "";
    var g = /[#&?]gid=(\d+)/.exec(link);
    return "https://docs.google.com/spreadsheets/d/" + m[1] + "/export?format=csv" + (g ? "&gid=" + g[1] : "");
  }
  window.SHEETS = { zip: zipStore, parseCsv: parseCsv, toCsv: toCsv, csvCell: csvCell, toXlsx: toXlsx, readXlsx: readXlsx, readFile: readFile, gsheetCsvUrl: gsheetCsvUrl };
})();
