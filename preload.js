const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // 메인 창의 메모 관리용 API
  loadMemos: () => ipcRenderer.invoke('load-memos'),
  saveMemos: (memos) => ipcRenderer.invoke('save-memos', memos),
  
  // 위젯 창 관리용 API
  showWidget: (memo) => ipcRenderer.send('show-widget', memo),
  closeWidget: (memoId) => ipcRenderer.send('close-widget', memoId),
  
  // 위젯 창 내 메모 관리용 API
  updateMemo: (memo) => ipcRenderer.send('update-memo', memo),
  saveWidgetPosition: (memoId, position) => ipcRenderer.send('save-widget-position', memoId, position),
  
  // 메인 프로세스로부터 이벤트 수신
  onMemoData: (callback) => ipcRenderer.on('memo-data', (_, memo) => callback(memo)),
  onMemosUpdated: (callback) => ipcRenderer.on('memos-updated', (_, memos) => callback(memos)),
}); 