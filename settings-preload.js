const { contextBridge, ipcRenderer } = require('electron')
contextBridge.exposeInMainWorld('settings', {
  get: () => ipcRenderer.invoke('settings-get'),
  set: patch => ipcRenderer.invoke('settings-set', patch),
  connect: remove => ipcRenderer.invoke('settings-hooks', remove),
  checkUpdates: () => ipcRenderer.invoke('settings-update'),
  installUpdate: () => ipcRenderer.invoke('settings-install-update'),
  testSound: () => ipcRenderer.invoke('settings-test-sound'),
  snap: corner => ipcRenderer.invoke('settings-snap', corner),
  openReleases: () => ipcRenderer.invoke('settings-releases'),
  onChange: fn => ipcRenderer.on('settings-changed', (_, data) => fn(data)),
})
