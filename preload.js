const { contextBridge, ipcRenderer } = require('electron')

const on = ch => fn => ipcRenderer.on(ch, (_, v) => fn(v))
contextBridge.exposeInMainWorld('pet', {
  onState: on('state'),
  onHelpers: on('helpers'),
  onMeta: on('meta'),
  onUsage: on('usage'),
  onWeather: on('weather'),
  onPrefs: on('prefs'),
  onSound: on('sound'),
  onBootPreview: on('boot-preview'),
  onVisibility: on('visibility'),
  openSettings: () => ipcRenderer.invoke('open-settings'),
  focusSession: id => ipcRenderer.invoke('focus-session', id),
  toggleSize: () => ipcRenderer.invoke('toggle-size'),
  helperInfo: id => ipcRenderer.invoke('helper-info', id),
})
