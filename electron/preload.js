const { contextBridge, ipcRenderer } = require("electron");

// New recommended API surface for renderer code.
contextBridge.exposeInMainWorld("api", {
  findCoffee: (address) => ipcRenderer.invoke("coffeeFinder:search", address),
});

// Backwards-compatible alias used by existing code paths.
contextBridge.exposeInMainWorld("coffeeFinder", {
  search: (address) => ipcRenderer.invoke("coffeeFinder:search", address),
});

