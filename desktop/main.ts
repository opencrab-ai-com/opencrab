import { existsSync } from "node:fs";
import path from "node:path";
import { app, BrowserWindow, dialog, shell } from "electron";
import { resolveDesktopPublicDir } from "./paths";
import type { DesktopRuntimeMode, DesktopRuntimeSession } from "./runtime-manager";
import { startDesktopRuntime } from "./runtime-manager";

let mainWindow: BrowserWindow | null = null;
let runtimeSession: DesktopRuntimeSession | null = null;
let isQuitting = false;
let isStoppingRuntime = false;

const singleInstanceLock = app.requestSingleInstanceLock();

if (!singleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow) {
      return;
    }

    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }

    mainWindow.focus();
  });

  app.whenReady().then(bootstrapDesktopApp).catch((error) => {
    showBootstrapError(error);
    app.quit();
  });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", (event) => {
  isQuitting = true;

  if (!runtimeSession || isStoppingRuntime) {
    return;
  }

  event.preventDefault();
  isStoppingRuntime = true;

  void stopRuntimeSession().finally(() => {
    app.quit();
  });
});

app.on("activate", () => {
  if (mainWindow || isQuitting) {
    return;
  }

  void bootstrapDesktopApp().catch((error) => {
    showBootstrapError(error);
    app.quit();
  });
});

async function bootstrapDesktopApp() {
  try {
    if (!runtimeSession) {
      runtimeSession = await startDesktopRuntime({
        mode: getDesktopRuntimeMode(),
      });
    }

    const window = createMainWindow(runtimeSession);
    mainWindow = window;
    await window.loadURL(runtimeSession.appOrigin);
  } catch (error) {
    if (mainWindow) {
      mainWindow.destroy();
      mainWindow = null;
    }

    await stopRuntimeSession();
    throw error;
  }
}

function createMainWindow(runtime: DesktopRuntimeSession) {
  const window = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1120,
    minHeight: 760,
    backgroundColor: "#f7f4ee",
    title: "OpenCrab",
    autoHideMenuBar: false,
    show: false,
    icon: resolveAppIcon(),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      sandbox: false,
      nodeIntegration: false,
    },
  });

  window.once("ready-to-show", () => {
    window.show();
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (isAppUrl(url, runtime.appOrigin)) {
      return { action: "allow" };
    }

    void shell.openExternal(url);
    return { action: "deny" };
  });

  window.webContents.on("will-navigate", (event, url) => {
    if (isAppUrl(url, runtime.appOrigin)) {
      return;
    }

    event.preventDefault();
    void shell.openExternal(url);
  });

  window.on("closed", () => {
    mainWindow = null;
  });

  return window;
}

function resolveAppIcon() {
  const iconPath = path.join(resolveDesktopPublicDir(), "branding", "png-app", "opencrab-mark-512.png");

  return existsSync(iconPath) ? iconPath : undefined;
}

function isAppUrl(candidateUrl: string, appOrigin: string) {
  try {
    return new URL(candidateUrl).origin === appOrigin;
  } catch {
    return false;
  }
}

function getDesktopRuntimeMode(): DesktopRuntimeMode {
  return process.env.OPENCRAB_DESKTOP_RUNTIME_MODE === "dev" ? "dev" : "standalone";
}

async function stopRuntimeSession() {
  if (!runtimeSession) {
    isStoppingRuntime = false;
    return;
  }

  const activeSession = runtimeSession;
  runtimeSession = null;

  try {
    await activeSession.stop();
  } finally {
    isStoppingRuntime = false;
  }
}

function showBootstrapError(error: unknown) {
  const message =
    error instanceof Error ? error.message : "OpenCrab desktop runtime failed to start.";

  dialog.showErrorBox("OpenCrab 启动失败", message);
}
