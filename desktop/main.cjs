const path = require("node:path");
const { app, BrowserWindow, dialog, shell } = require("electron");
const { createRuntimeManager, isAppUrl } = require("./runtime-manager.cjs");

const runtimeManager = createRuntimeManager({
  packaged: app.isPackaged,
  resourcesPath: process.resourcesPath,
});
const preloadPath = path.join(__dirname, "preload.cjs");
let mainWindow = null;

if (!app.requestSingleInstanceLock()) {
  app.quit();
}

app.on("second-instance", () => {
  if (!mainWindow) {
    return;
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }

  mainWindow.focus();
});

app.whenReady().then(async () => {
  mainWindow = createMainWindow();
  await mainWindow.loadURL(createLoadingPage());

  try {
    const baseUrl = await runtimeManager.ensureStarted();
    await mainWindow.loadURL(baseUrl);
    mainWindow.show();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "OpenCrab desktop 启动 shared runtime 失败。";
    dialog.showErrorBox("OpenCrab 启动失败", message);
    app.exit(1);
    return;
  }

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length > 0) {
      return;
    }

    mainWindow = createMainWindow();
    await mainWindow.loadURL(runtimeManager.baseUrl);
    mainWindow.show();
  });
});

app.on("before-quit", () => {
  runtimeManager.stop();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

function createMainWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1100,
    minHeight: 720,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    backgroundColor: "#f7f4ec",
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (isAppUrl(url, runtimeManager.baseUrl)) {
      void window.loadURL(url);
      return { action: "deny" };
    }

    void shell.openExternal(url);
    return { action: "deny" };
  });

  window.webContents.on("will-navigate", (event, url) => {
    if (isAppUrl(url, runtimeManager.baseUrl)) {
      return;
    }

    event.preventDefault();
    void shell.openExternal(url);
  });

  return window;
}

function createLoadingPage() {
  const html = `
    <html>
      <head>
        <meta charset="utf-8" />
        <title>OpenCrab</title>
        <style>
          :root {
            color-scheme: light;
          }
          body {
            margin: 0;
            font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif;
            background: linear-gradient(180deg, #f8f3ea 0%, #f2ede4 100%);
            color: #201c17;
            display: grid;
            place-items: center;
            min-height: 100vh;
          }
          main {
            text-align: center;
            padding: 32px;
          }
          h1 {
            margin: 0 0 12px;
            font-size: 28px;
            letter-spacing: -0.04em;
          }
          p {
            margin: 0;
            font-size: 14px;
            line-height: 1.7;
            color: #5c544a;
          }
        </style>
      </head>
      <body>
        <main>
          <h1>OpenCrab 正在启动</h1>
          <p>桌面壳已经就绪，正在连接共享 runtime。</p>
        </main>
      </body>
    </html>
  `;

  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
}
