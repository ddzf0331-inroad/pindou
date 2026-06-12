const fs = require("fs");
const path = require("path");
const { app, BrowserWindow, shell } = require("electron");
const { startServer } = require("../server.js");

let mainWindow = null;
let appServer = null;

const DEFAULT_FILES = ["palette.json", "projects.json", "palette-limit.json", "settings.json"];

async function main() {
  await app.whenReady();

  const rootDir = app.getAppPath();
  const dataDir = app.getPath("userData");
  initializeDefaultData(rootDir, dataDir);

  const started = startServer({
    rootDir,
    dataDir,
    port: 0,
    mode: "electron-local-server",
    stateMode: "local-server"
  });
  appServer = started.server;
  const { url } = await started.ready;

  mainWindow = createMainWindow();
  await mainWindow.loadURL(url);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow();
      mainWindow.loadURL(url);
    }
  });
}

function createMainWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 1024,
    minHeight: 720,
    title: "拼豆设计",
    backgroundColor: "#f5f7fb",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  });

  win.setMenuBarVisibility(false);
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
  return win;
}

function initializeDefaultData(rootDir, dataDir) {
  const defaultsDir = path.join(rootDir, "defaults");
  fs.mkdirSync(dataDir, { recursive: true });
  for (const fileName of DEFAULT_FILES) {
    const targetPath = path.join(dataDir, fileName);
    if (fs.existsSync(targetPath)) continue;
    const sourcePath = path.join(defaultsDir, fileName);
    if (fs.existsSync(sourcePath)) {
      fs.copyFileSync(sourcePath, targetPath);
    }
  }
}

app.on("window-all-closed", () => {
  app.quit();
});

app.on("before-quit", () => {
  if (appServer?.listening) {
    appServer.close();
  }
});

main().catch((error) => {
  console.error(error);
  app.quit();
});
