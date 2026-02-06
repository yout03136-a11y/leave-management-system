
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  db: {
    getAll: (table) => ipcRenderer.invoke('db-get-all', table),
    bulkSave: (table, items) => ipcRenderer.invoke('db-bulk-save', { table, items }),
    updatePassword: (userId, newPassword) => ipcRenderer.invoke('update-password', { userId, newPassword })
  },
  auth: {
    login: (username, password) => ipcRenderer.invoke('auth-login', { username, password })
  }
});
