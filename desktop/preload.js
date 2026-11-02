const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  platform: process.platform,
  formFactor: 'desktop',
  version: process.versions.electron,
  quickCaptureShortcut: 'Ctrl+Shift+Espacio',
  onQuickCapture: (callback) => {
    ipcRenderer.on('nexus:quick-capture', () => callback());
  }
});
