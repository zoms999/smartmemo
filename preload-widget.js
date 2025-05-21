// preload-widget.js
const { contextBridge, ipcRenderer } = require('electron');

// 메인 프로세스에서 전달된 argument 파싱 (메모 ID 가져오기)
const args = process.argv;
let memoIdFromArg = null;
args.forEach(arg => {
    if (arg.startsWith('--memo-id=')) {
        memoIdFromArg = parseInt(arg.split('=')[1], 10);
    }
});

contextBridge.exposeInMainWorld('electronWidgetAPI', {
    getMemoId: () => memoIdFromArg,
    onInitializeWidget: (callback) => ipcRenderer.on('initialize-widget', (event, memo) => callback(memo)),
    updateContent: (memoId, newContent) => ipcRenderer.invoke('update-memo-content-from-widget', { memoId, newContent }),
    returnToPanel: (memoId) => ipcRenderer.send('return-widget-to-panel', memoId),
    closeWidget: (memoId) => ipcRenderer.send('return-widget-to-panel', memoId), // 닫기도 패널로 복귀와 동일하게 처리

    // 추가된 메서드들
    updateWidgetStatus: (memoId, isWidget) => ipcRenderer.invoke('update-widget-status', { memoId, isWidget }),
    notifyPanelToShowMemo: (memoId) => ipcRenderer.send('force-show-memo', memoId),
    refreshPanel: () => ipcRenderer.send('refresh-panel')
});
