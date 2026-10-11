const { contextBridge, ipcRenderer } = require('electron')

const on = ch => fn => ipcRenderer.on(ch, (_, v) => fn(v))
contextBridge.exposeInMainWorld('pet', {
  onState: on('state'),
  onHelpers: on('helpers'),
  onMeta: on('meta'),
  onUsage: on('usage'),
  onWeather: on('weather'),
  onPrefs: on('prefs'),
  focusSession: id => ipcRenderer.invoke('focus-session', id),
  helperInfo: id => ipcRenderer.invoke('helper-info', id),
})
