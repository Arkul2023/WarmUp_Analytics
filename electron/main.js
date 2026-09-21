const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Load frontend dev server by env or built index.html
  const devUrl = process.env.ELECTRON_DEV_URL;
  if (devUrl) {
    win.loadURL(devUrl);
  } else {
    win.loadFile(path.join(__dirname, '..', 'frontend', 'dist', 'index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// Minimal IPC example: forward to backend via fetch if needed
ipcMain.handle('backend-ping', async (event) => {
  // Allows renderer to check backend connectivity via main
  try {
    const resp = await fetch(process.env.ELECTRON_API_BASE || 'http://localhost:4000' + '/api/dashboard/summary');
    return { ok: resp.ok };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
});
