/* PWA: registra il service worker solo quando la pagina è servita via http(s), non nella versione installata (Electron) né da file locale. */
if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol) && !window.desk) navigator.serviceWorker.register("sw.js").catch(function () {});
