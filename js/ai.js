/* Tornei Fragmarathon: generazione di loghi con un'AI per immagini.
   Quattro tipi di servizio, gratuiti o installabili in locale:
   - pollinations: online, con chiave personale gratuita (gen.pollinations.ai, chiave da enter.pollinations.ai)
   - hf: Hugging Face Inference, con token personale gratuito (crediti mensili inclusi nell'account)
   - a1111: Stable Diffusion in locale con AUTOMATIC1111, Forge o SD.Next (API /sdapi/v1/txt2img)
   - openai: qualsiasi server con API "images/generations" compatibile OpenAI
     (LocalAI in locale, oppure un servizio remoto con la sua chiave)
   Lo stesso file gira nella pagina (window.AI) e nel processo principale di Electron
   (require), dove le richieste non hanno limiti CORS. Restituisce sempre un data: URL. */
(function (root) {
  "use strict";
  var DEF = {
    pollinations: { url: "https://gen.pollinations.ai", model: "tongyi-mai/z-image-turbo", key: true, keyUrl: "https://enter.pollinations.ai/keys" },
    hf: { url: "https://router.huggingface.co/hf-inference/models", model: "black-forest-labs/FLUX.1-schnell", key: true, keyUrl: "https://huggingface.co/settings/tokens" },
    a1111: { url: "http://127.0.0.1:7860", model: "" },
    openai: { url: "http://127.0.0.1:8080/v1", model: "stablediffusion" }
  };
  var NEG = "text, letters, watermark, signature, blurry, low quality, photo, busy background";

  function b64(buf) {
    if (typeof Buffer !== "undefined") return Buffer.from(buf).toString("base64");
    var s = "", a = new Uint8Array(buf);
    for (var i = 0; i < a.length; i += 0x8000) s += String.fromCharCode.apply(null, a.subarray(i, i + 0x8000));
    return btoa(s);
  }
  function cleanUrl(u) {
    u = String(u || "").trim().replace(/\/+$/, "");
    if (!/^https?:\/\/[^\s]+$/i.test(u)) throw new Error("Indirizzo non valido: deve iniziare con http:// o https://");
    return u;
  }
  function timeout(ms) { return typeof AbortSignal !== "undefined" && AbortSignal.timeout ? AbortSignal.timeout(ms) : undefined; }
  async function asDataUrl(res) {
    if (!res.ok) throw new Error("Il servizio ha risposto " + res.status + (res.statusText ? " " + res.statusText : ""));
    var type = (res.headers.get("content-type") || "image/png").split(";")[0];
    if (!/^image\//.test(type)) throw new Error("Il servizio non ha restituito un'immagine (" + type + ")");
    var buf = await res.arrayBuffer();
    if (buf.byteLength > 15e6) throw new Error("Immagine troppo grande");
    return "data:" + type + ";base64," + b64(buf);
  }
  async function json(res) {
    if (!res.ok) { var t = ""; try { t = (await res.text()).slice(0, 160); } catch (e) {} throw new Error("Il servizio ha risposto " + res.status + (t ? ": " + t : "")); }
    return res.json();
  }

  /* cfg = {prov, url, model, key}; size in pixel (quadrata). */
  async function generate(cfg, prompt, seed, size) {
    var prov = cfg && DEF[cfg.prov] ? cfg.prov : "pollinations", d = DEF[prov];
    var url = cleanUrl(cfg.url || d.url), model = (cfg.model || d.model || "").trim();
    size = size || 512; seed = seed == null ? Math.floor(Math.random() * 1e9) : seed;
    prompt = String(prompt || "").trim().slice(0, 900);
    if (!prompt) throw new Error("Scrivi una descrizione del logo");
    var key = String(cfg.key || "").trim();
    if (d.key && !key) throw new Error("Serve la chiave personale gratuita: creala su " + d.keyUrl.replace(/^https:\/\//, ""));
    if (prov === "pollinations") {
      var q = "?width=" + size + "&height=" + size + "&seed=" + seed + (model ? "&model=" + encodeURIComponent(model) : "");
      return asDataUrl(await fetch(url + "/image/" + encodeURIComponent(prompt) + q, { headers: { Authorization: "Bearer " + key }, signal: timeout(180000) }));
    }
    if (prov === "hf") {
      var hr = await fetch(url + "/" + model.split("/").map(encodeURIComponent).join("/"), {
        method: "POST", signal: timeout(180000),
        headers: { Authorization: "Bearer " + key, "Content-Type": "application/json", Accept: "image/png" },
        body: JSON.stringify({ inputs: prompt, parameters: { width: size, height: size, seed: seed } })
      });
      if (!hr.ok) { var ht = ""; try { ht = (await hr.text()).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 160); } catch (e) {} throw new Error("Il servizio ha risposto " + hr.status + (ht ? ": " + ht : "")); }
      return asDataUrl(hr);
    }
    if (prov === "a1111") {
      var r = await json(await fetch(url + "/sdapi/v1/txt2img", {
        method: "POST", headers: { "Content-Type": "application/json" }, signal: timeout(300000),
        body: JSON.stringify({ prompt: prompt, negative_prompt: NEG, width: size, height: size, steps: 24, cfg_scale: 7, seed: seed, batch_size: 1, n_iter: 1 })
      }));
      if (!r.images || !r.images[0]) throw new Error("Nessuna immagine nella risposta");
      return "data:image/png;base64," + String(r.images[0]).replace(/^data:image\/\w+;base64,/, "");
    }
    var h = { "Content-Type": "application/json" };
    if (key) h.Authorization = "Bearer " + key;
    var o = await json(await fetch(url + "/images/generations", {
      method: "POST", headers: h, signal: timeout(300000),
      body: JSON.stringify({ model: model || undefined, prompt: prompt, n: 1, size: size + "x" + size, response_format: "b64_json" })
    }));
    var it = o.data && o.data[0];
    if (!it) throw new Error("Nessuna immagine nella risposta");
    if (it.b64_json) return "data:image/png;base64," + it.b64_json;
    if (it.url) return asDataUrl(await fetch(it.url, { signal: timeout(120000) }));
    throw new Error("Risposta non riconosciuta");
  }

  var AI = { DEF: DEF, generate: generate };
  if (typeof module !== "undefined" && module.exports) module.exports = AI;
  else root.AI = AI;
})(this);
