// preload-panel.js
const { contextBridge, ipcRenderer } = require('electron');

console.log('preload-panel.js 실행 시작');

// 수신 이벤트 로깅 기능
function createLoggedReceiver(channel, callback) {
    return (handler) => {
        console.log(`${channel} 이벤트 리스너 등록됨`);
        return ipcRenderer.on(channel, (event, ...args) => {
            console.log(`${channel} 이벤트 수신됨:`, ...args);
            if (callback) {
                callback(...args);
            }
            handler(...args);
        });
    };
}

// 송신 이벤트 로깅 기능
function createLoggedSender(channel) {
    return (...args) => {
        console.log(`${channel} 이벤트 전송:`, ...args);
        return ipcRenderer.send(channel, ...args);
    };
}

// 핸들러 로깅 기능
function createLoggedHandler(channel) {
    return async (...args) => {
        console.log(`${channel} 핸들러 호출:`, ...args);
        try {
            const result = await ipcRenderer.invoke(channel, ...args);
            console.log(`${channel} 핸들러 결과:`, result);
            return result;
        } catch (error) {
            console.error(`${channel} 핸들러 오류:`, error);
            throw error;
        }
    };
}

// API 정의
const electronAPI = {
    // 메모 데이터 관리
    getMemos: createLoggedHandler('get-memos'),
    saveMemos: createLoggedHandler('save-memos'),

    // 카테고리 관리
    getCategories: createLoggedHandler('get-categories'),
    saveCategories: createLoggedHandler('save-categories'),

    // 태그 관리
    getTags: createLoggedHandler('get-tags'),
    saveTags: createLoggedHandler('save-tags'),

    // 인증 관련
    getAuthStatus: createLoggedHandler('get-auth-status'),

    // 패널 제어
    closePanel: createLoggedSender('close-panel'),

    // 패널 애니메이션 이벤트 수신
    onPanelSlideIn: createLoggedReceiver('panel-slide-in'),
    onPanelSlideOut: createLoggedReceiver('panel-slide-out'),

    // 위젯 관련 기능
    createWidget: createLoggedHandler('create-widget'),
    closeWidget: createLoggedSender('return-widget-to-panel'),

    // 위젯에서 내용 변경 시 패널에 알림 수신
    onMemoUpdateFromWidget: createLoggedReceiver('update-memo-from-widget'),

    // 위젯 창 닫힐 때 알림 수신
    onWidgetClosed: createLoggedReceiver('widget-closed'),

    // 위젯의 상태(is_widget) 변경 이벤트 수신
    onUpdateWidgetStatus: createLoggedReceiver('update-widget-status'),

    // 메모를 강제로 표시해야 할 때 수신 - 패널로 되돌리기 시 사용
    onForceShowMemo: createLoggedReceiver('force-show-memo'),

    // 모든 필터 초기화 이벤트 수신
    onResetAllFilters: createLoggedReceiver('reset-all-filters'),

    // 패널 메모 목록 새로고침 요청 이벤트 수신
    onRefreshMemos: createLoggedReceiver('refresh-memos'),

    // 위젯의 위치/크기 변경 시 알림 수신 (패널에서 데이터 업데이트용)
    onUpdateMemoWidgetState: createLoggedReceiver('update-memo-widget-state'),

    // 메모 포커스 요청
    onShowPanelAndFocusMemo: createLoggedReceiver('show-panel-and-focus-memo'),

    // 설정 관련 API
    getSettings: createLoggedHandler('get-settings'),
    updateSettings: createLoggedHandler('update-settings'),
    getAppVersion: createLoggedHandler('get-app-version'),

    // 앱 정보 창 및 설정 창 열기
    openAboutWindow: createLoggedSender('open-about-window'),
    openSettingsWindow: createLoggedSender('open-settings-window'),

    // 업데이트 관련 이벤트 수신
    onUpdateAvailable: createLoggedReceiver('update-available'),
    onUpdateProgress: createLoggedReceiver('update-progress'),
    onUpdateDownloaded: createLoggedReceiver('update-downloaded'),

    // 외부 링크 열기
    openExternalLink: createLoggedSender('open-external-link'),

    // 마크다운 변환
    convertMarkdown: createLoggedHandler('convert-markdown'),

    // 이미지 첨부
    selectImage: createLoggedHandler('select-image'),

    // 리마인더 설정
    scheduleReminder: createLoggedHandler('schedule-reminder'),

    // 데이터 내보내기/가져오기
    exportData: createLoggedHandler('export-data'),
    importData: createLoggedHandler('import-data'),

    // 데이터베이스 관련 함수
    deleteMemoFromDb: createLoggedHandler('delete-memo-from-db'),

    // 인증 관련 함수
    getAuthState: createLoggedHandler('get-auth-state'),
    signOut: createLoggedHandler('sign-out'),

    // 로그인 창 열기 - 직접 함수 정의로 변경
    openLoginWindow: () => {
        console.log('openLoginWindow 함수 직접 호출됨');
        ipcRenderer.send('open-login-window');
        console.log('open-login-window 이벤트 전송 완료');
    },

    // 로그인 오류 이벤트 수신
    onLoginError: createLoggedReceiver('login-error')
};

// API 노출
console.log('electronAPI 노출:', Object.keys(electronAPI).join(', '));
contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// 디버깅 도구 노출
contextBridge.exposeInMainWorld('preloadDebug', {
    ping: () => 'pong',
    ipcChannels: {
        send: Object.keys(ipcRenderer).filter(k => typeof ipcRenderer[k] === 'function'),
        receive: ['panel-slide-in', 'panel-slide-out', 'update-memo-from-widget', 'widget-closed', 'update-widget-status', 'force-show-memo', 'reset-all-filters']
    }
});

console.log('preload-panel.js 실행 완료');
