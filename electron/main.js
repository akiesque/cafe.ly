const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");

// IPC handler for coffee finder – calls the OSM-based backend.
ipcMain.handle("coffeeFinder:search", async (_event, address) => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { findCoffeeShopsByAddressOSM } = require("../src/coffeeFinder/osmFinder");
  const trimmed = String(address ?? "").trim();
  return await findCoffeeShopsByAddressOSM(trimmed);
});

function createWindow() {
  const win = new BrowserWindow({
    width: 950,
    height: 900,
    // resizable: false, // remove after testing
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
    autoHideMenuBar: true,
  });

  // Load the local HTML file
  win.loadFile("index.html");
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

