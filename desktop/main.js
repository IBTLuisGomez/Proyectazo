const { app, BrowserWindow, Menu, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

let mainWindow = null;
let pythonProcess = null;

function boundsFile() {
  return path.join(app.getPath('userData'), 'window-bounds.json');
}

function loadBounds() {
  try {
    const raw = JSON.parse(fs.readFileSync(boundsFile(), 'utf8'));
    if (!raw || typeof raw.width !== 'number' || typeof raw.height !== 'number') return null;
    const displays = screen.getAllDisplays();
    const visible = displays.some(display => {
      const area = display.workArea;
      return raw.x >= area.x - 20 && raw.x < area.x + area.width &&
        raw.y >= area.y - 20 && raw.y < area.y + area.height;
    });
    return visible || raw.x === undefined ? raw : null;
  } catch (err) {
    return null;
  }
}

function saveBounds() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const bounds = mainWindow.getBounds();
  try {
    fs.writeFileSync(boundsFile(), JSON.stringify(bounds));
  } catch (err) {
    console.warn('No se pudo guardar el tamaño de la ventana:', err);
  }
}

function startBackendService() {
  const pythonScript = path.join(__dirname, '..', 'nexus_service.py');
  if (!fs.existsSync(pythonScript)) return;
  try {
    pythonProcess = spawn('python', [pythonScript], {
      cwd: path.join(__dirname, '..'),
      detached: true,
      stdio: 'ignore',
      windowsHide: true
    });
    pythonProcess.unref();
  } catch (err) {
    console.warn('No se pudo arrancar nexus_service.py desde Electron:', err);
  }
}

function createWindow() {
  const saved = loadBounds();
  mainWindow = new BrowserWindow({
    width: saved?.width || 1380,
    height: saved?.height || 920,
    x: saved?.x,
    y: saved?.y,
    minWidth: 1024,
    minHeight: 680,
    title: 'FocusFlow OS — Nexus Orb',
    icon: path.join(__dirname, '..', 'assets', 'logo_icon_sin_bk.png'),
    backgroundColor: '#0f131d',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      backgroundThrottling: false,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  Menu.setApplicationMenu(null);
  mainWindow.loadFile(path.join(__dirname, '..', 'index.html'));
  mainWindow.once('ready-to-show', () => {
    if (saved && saved.isMaximized) mainWindow.maximize();
    mainWindow.show();
  });

  const remember = () => saveBounds();
  mainWindow.on('resize', remember);
  mainWindow.on('move', remember);
  mainWindow.on('close', () => {
    try {
      const bounds = mainWindow.getBounds();
      bounds.isMaximized = mainWindow.isMaximized();
      fs.writeFileSync(boundsFile(), JSON.stringify(bounds));
    } catch (err) {}
  });
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  app.whenReady().then(() => {
    app.setAppUserModelId('com.nexusorb.focusflow');
    startBackendService();
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

app.on('window-all-closed', () => {
  if (pythonProcess && !pythonProcess.killed) {
    try { pythonProcess.kill(); } catch (err) {}
  }
  if (process.platform !== 'darwin') app.quit();
});
