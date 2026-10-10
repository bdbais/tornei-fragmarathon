/* Tornei Fragmarathon: backup cifrati con password.
   AES-256-GCM con chiave ricavata dalla password (PBKDF2-SHA256, 310.000 iterazioni, sale casuale),
   dati compressi con gzip prima di cifrare. Senza la password giusta il file non si apre:
   AES-GCM verifica anche che nessuno l'abbia modificato. */
(function () {
  "use strict";
  var ITER = 310000;
  function b64(u8) { var s = "", i, n = 0x8000; for (i = 0; i < u8.length; i += n) s += String.fromCharCode.apply(null, u8.subarray(i, i + n)); return btoa(s); }
  function unb64(s) { var b = atob(s), u = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
  function pipe(u8, T) { return new Response(new Blob([u8]).stream().pipeThrough(new T("gzip"))).arrayBuffer().then(function (b) { return new Uint8Array(b); }); }
  function key(pw, salt, iter) {
    return crypto.subtle.importKey("raw", new TextEncoder().encode(pw), "PBKDF2", false, ["deriveKey"]).then(function (base) {
      return crypto.subtle.deriveKey({ name: "PBKDF2", salt: salt, iterations: iter, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
    });
  }
  function encrypt(obj, pw) {
    if (!pw || pw.length < 6) return Promise.reject(new Error("La password deve avere almeno 6 caratteri."));
    var salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
    var raw = new TextEncoder().encode(JSON.stringify(obj));
    return Promise.all([pipe(raw, CompressionStream), key(pw, salt, ITER)]).then(function (r) {
      return crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, r[1], r[0]);
    }).then(function (ct) {
      return JSON.stringify({ app: "tornei-fragmarathon", kind: "backup-cifrato", v: 1, cipher: "AES-256-GCM", kdf: "PBKDF2-SHA256", iter: ITER, gz: true, salt: b64(salt), iv: b64(iv), data: b64(new Uint8Array(ct)) });
    });
  }
  function isEnc(text) { try { var j = typeof text === "string" ? JSON.parse(text) : text; return !!(j && j.kind === "backup-cifrato" && j.data); } catch (e) { return false; } }
  function decrypt(text, pw) {
    var j = typeof text === "string" ? JSON.parse(text) : text;
    if (!pw) return Promise.reject(new Error("Scrivi la password del backup."));
    return key(pw, unb64(j.salt), j.iter || ITER).then(function (k) {
      return crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(j.iv) }, k, unb64(j.data));
    }).then(function (pt) {
      var u = new Uint8Array(pt);
      return j.gz ? pipe(u, DecompressionStream) : u;
    }, function () { throw new Error("Password sbagliata, oppure il file è danneggiato."); })
      .then(function (u) { return JSON.parse(new TextDecoder().decode(u)); });
  }
  window.CRYPT = { encrypt: encrypt, decrypt: decrypt, isEnc: isEnc };
})();
