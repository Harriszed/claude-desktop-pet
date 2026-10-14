const { contextBridge, ipcRenderer } = require('electron')
contextBridge.exposeInMainWorld('settings', {
  get: () => ipcRenderer.invoke('settings-get'),
  set: patch => ipcRenderer.invoke('settings-set', patch),
  connect: remove => ipcRenderer.invoke('settings-hooks', remove),
  testConnection: () => ipcRenderer.invoke('settings-test-connection'),
  checkUpdates: () => ipcRenderer.invoke('settings-update'),
  installUpdate: () => ipcRenderer.invoke('settings-install-update'),
  testSound: () => ipcRenderer.invoke('settings-test-sound'),
  previewBoot: () => ipcRenderer.invoke('settings-preview-boot'),
  snap: corner => ipcRenderer.invoke('settings-snap', corner),
  openReleases: () => ipcRenderer.invoke('settings-releases'),
  onChange: fn => ipcRenderer.on('settings-changed', (_, data) => fn(data)),
})
