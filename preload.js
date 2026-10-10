/* Ponte sicuro tra la pagina e il sistema: solo queste funzioni, niente accesso diretto a Node. */
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desk", {
  info: () => ipcRenderer.invoke("info"),
  listTornei: () => ipcRenderer.invoke("tornei:list"),
  saveTorneo: (file, data, title) => ipcRenderer.invoke("tornei:save", file, data, title),
  readTorneo: (file) => ipcRenderer.invoke("tornei:read", file),
  writeBackup: (label, data) => ipcRenderer.invoke("backup:write", label, data),
  listBackups: () => ipcRenderer.invoke("backup:list"),
  readBackup: (file) => ipcRenderer.invoke("backup:read", file),
  openFolder: (which) => ipcRenderer.invoke("folder:open", which),
  openWall: () => ipcRenderer.invoke("wall:open"),
  aiImage: (cfg, prompt, seed, size) => ipcRenderer.invoke("ai:image", cfg, prompt, seed, size),
  botState: (vm) => ipcRenderer.invoke("bot:state", vm),
  botStatus: () => ipcRenderer.invoke("bot:status"),
  botConfig: (c) => ipcRenderer.invoke("bot:config", c),
  botDecide: (id, ok) => ipcRenderer.invoke("bot:decide", id, ok),
  botPng: (id, data) => ipcRenderer.invoke("bot:png", id, data),
  onBot: (cb) => ipcRenderer.on("bot", (_e, m) => cb(m)),
  /* diretta: comandi dalla finestra principale */
  streamStatus: () => ipcRenderer.invoke("stream:status"),
  streamConfig: (c) => ipcRenderer.invoke("stream:config", c),
  streamStart: () => ipcRenderer.invoke("stream:start"),
  streamStop: () => ipcRenderer.invoke("stream:stop"),
  streamScene: (s, cam) => ipcRenderer.invoke("stream:scene", s, cam),
  streamSources: () => ipcRenderer.invoke("stream:sources"),
  streamGetPreview: () => ipcRenderer.invoke("stream:getPreview"),
  onStream: (cb) => ipcRenderer.on("stream", (_e, s) => cb(s)),
  /* diretta: canale della finestra nascosta che compone l'immagine */
  onStreamCmd: (cb) => ipcRenderer.on("stream-cmd", (_e, m) => cb(m)),
  onStreamFrame: (cb) => ipcRenderer.on("stream-frame", (_e, jpg) => cb(jpg)),
  streamReady: (r) => ipcRenderer.send("stream:ready", r),
  streamChunk: (gen, buf) => ipcRenderer.send("stream:chunk", gen, buf),
  streamPreview: (d) => ipcRenderer.send("stream:preview", d),
  checkUpdate: () => ipcRenderer.invoke("update:check"),
  installUpdate: () => ipcRenderer.invoke("update:install"),
  onUpdate: (cb) => ipcRenderer.on("update", (_e, s) => cb(s))
});
