import { contextBridge } from "electron";

contextBridge.exposeInMainWorld("opencrabDesktop", {
  isDesktopApp: true,
  platform: process.platform,
  runtimeMode: process.env.OPENCRAB_DESKTOP_RUNTIME_MODE || "unknown",
});
