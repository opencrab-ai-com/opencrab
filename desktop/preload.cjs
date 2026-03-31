const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("opencrabDesktop", {
  isDesktop: true,
  platform: process.platform,
});
