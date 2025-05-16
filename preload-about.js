const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('aboutAPI', {
  // 앱 정보 관련 API
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  
  // 외부 링크 열기
  openExternalLink: (url) => ipcRenderer.send('open-external-link', url)
}); 