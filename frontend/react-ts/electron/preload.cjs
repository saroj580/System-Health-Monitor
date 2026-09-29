// electron/preload.cjs
// Secure context bridge for Electron renderer

const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('desktopApi', {
  platform: process.platform,
  isElectron: true,
});
