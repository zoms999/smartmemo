const { contextBridge, ipcRenderer } = require('electron');

console.log('preload-login.js 실행 시작');

// API 정의
const electronLoginAPI = {
    // 구글 로그인 요청
    signInWithGoogle: async () => {
        console.log('signInWithGoogle 함수 호출됨');
        try {
            const result = await ipcRenderer.invoke('sign-in-with-google');
            console.log('구글 로그인 요청 결과:', result);
            return result;
        } catch (error) {
            console.error('구글 로그인 요청 오류:', error);
            return { success: false, error: error.message };
        }
    },

    // 수동으로 OAuth 콜백 URL 처리
    processOAuthCallback: async (url) => {
        console.log('processOAuthCallback 함수 호출됨:', url);
        try {
            const result = await ipcRenderer.invoke('process-oauth-callback', url);
            console.log('OAuth 콜백 처리 결과:', result);
            return result;
        } catch (error) {
            console.error('OAuth 콜백 처리 오류:', error);
            return { success: false, error: error.message };
        }
    },

    // 로그인 건너뛰기
    skipLogin: () => {
        console.log('skipLogin 함수 호출됨');
        ipcRenderer.send('skip-login');
    },

    // 앱 메인 화면으로 이동
    navigateToApp: () => {
        console.log('navigateToApp 함수 호출됨');
        ipcRenderer.send('navigate-to-app');
    },

    // 로그인 성공 이벤트 리스너
    onGoogleLoginSuccess: (callback) => {
        console.log('Google 로그인 성공 이벤트 리스너 등록');
        // 이전 리스너 제거하여 중복 실행 방지
        ipcRenderer.removeAllListeners('google-login-success');

        ipcRenderer.on('google-login-success', (event, data) => {
            console.log('google-login-success 이벤트 수신', data);

            // 데이터가 문자열(URL)로 전송된 경우를 위한 하위 호환성
            const callbackData = typeof data === 'string'
                ? { url: data, success: true }
                : data;

            callback(callbackData);
        });
    },

    // 로그인 오류 이벤트 리스너
    onLoginError: (callback) => {
        console.log('로그인 오류 이벤트 리스너 등록');
        ipcRenderer.on('login-error', (event, message) => {
            console.log('login-error 이벤트 수신', message);
            callback(message);
        });
    }
};

// API 노출
console.log('electronLoginAPI 노출:', Object.keys(electronLoginAPI).join(', '));
contextBridge.exposeInMainWorld('electronLoginAPI', electronLoginAPI);

// 디버깅 도구 노출
contextBridge.exposeInMainWorld('preloadLoginDebug', {
    ping: () => 'pong from login preload',
    ipcChannels: {
        send: ['skip-login', 'navigate-to-app'],
        receive: ['google-login-success', 'login-error'],
        invoke: ['sign-in-with-google', 'process-oauth-callback']
    }
});

console.log('preload-login.js 실행 완료');
