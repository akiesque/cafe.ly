const { app, BrowserWindow, ipcMain, session } = require("electron");
const path = require("path");

// IPC handler for coffee finder – calls the OSM-based backend.
ipcMain.handle("coffeeFinder:search", async (_event, query) => {
  // Lazy-load to keep startup fast and avoid circular deps.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { findCoffeeShopsByAddress, findNearbyCoffeeShops } = require("../src/coffeeFinder/osmFinder");

  // Support both string addresses and direct { lat, lon } objects from the renderer.
  if (query && typeof query === "object" && query !== null) {
    const { lat, lon } = query;
    if (typeof lat === "number" && typeof lon === "number") {
      try {
        return await findNearbyCoffeeShops(lat, lon);
      } catch (error) {
        console.error("OSM coffee finder error (lat/lon):", error);
        return {
          user: null,
          results: [],
          error: "osm_overpass_busy",
          message:
            "The OpenStreetMap Overpass servers are busy right now. Please try again in a minute.",
        };
      }
    }
  }

  const trimmed = String(query ?? "").trim();
  if (!trimmed) {
    return { user: null, results: [] };
  }

  try {
    return await findCoffeeShopsByAddress(trimmed);
  } catch (error) {
    console.error("OSM coffee finder error:", error);
    return {
      user: null,
      results: [],
      error: "osm_overpass_busy",
      message:
        "The OpenStreetMap Overpass servers are busy right now. Please try again in a minute.",
    };
  }
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
  // Allow geolocation requests from the renderer.
  session.defaultSession.setPermissionRequestHandler(
    (webContents, permission, callback) => {
      if (permission === "geolocation") {
        callback(true);
      } else {
        callback(false);
      }
    }
  );

  // Allow geolocation without HTTPS (we load from file:// in Electron).
  app.commandLine.appendSwitch(
    "enable-features",
    "InsecureGeolocationRequests"
  );

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

