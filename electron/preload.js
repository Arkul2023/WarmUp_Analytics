const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  pingBackend: () => ipcRenderer.invoke('backend-ping'),
});
