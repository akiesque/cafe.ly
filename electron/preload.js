const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("coffeeFinder", {
  search: (address) => ipcRenderer.invoke("coffeeFinder:search", address),
});

