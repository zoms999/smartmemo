// main.js
const { app, BrowserWindow, ipcMain, Menu, Tray, nativeImage, screen, nativeTheme, dialog, shell, globalShortcut, Notification } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const http = require('node:http');
const url = require('node:url');
const Store = require('electron-store');
const { autoUpdater } = require('electron-updater');
const marked = require('marked');

// OAuth 콜백을 위한 로컬 서버 포트 정의
const LOCAL_CALLBACK_PORT = 8989;

// 한글 깨짐 방지를 위한 인코딩 설정
process.env.LANG = 'ko_KR.UTF-8';
if (process.platform === 'win32') {
  process.env.LC_ALL = 'ko_KR.UTF-8';

  // 콘솔 인코딩 설정
  try {
    // UTF-8 설정 스크립트 로드
    const setUtf8 = require('./set-utf8');
    console.log('콘솔 UTF-8 설정 로드됨');
  } catch (error) {
    console.error('UTF-8 설정 로드 오류:', error);
  }
}

// Node.js stdout/stderr에 UTF-8 설정
if (process.stdout.isTTY) {
  process.stdout.setEncoding('utf8');
}
if (process.stderr.isTTY) {
  process.stderr.setEncoding('utf8');
}

// 로그 출력 함수
function log(...args) {
  console.log(...args);
}

// 로그 오류 출력 함수
function logError(...args) {
  console.error(...args);
}

// Supabase 데이터베이스 연결 모듈 불러오기 (실패해도 계속 진행)
let db;
try {
  db = require('./supabase');
  // 추가 검증: Supabase 객체가 실제로 존재하는지 확인
  if (!db || !db.supabase) {
    throw new Error('Supabase 객체가 초기화되지 않았습니다.');
  }
  log('Supabase 모듈 로드 성공');

  // 연결 테스트 시도
  setTimeout(async () => {
    try {
      const testResult = await db.testConnection();
      if (testResult) {
        log('Supabase 연결 테스트 성공');
      } else {
        logError('Supabase 연결 테스트 실패');
      }
    } catch (testError) {
      logError('Supabase 연결 테스트 오류:', testError);
    }
  }, 500);
} catch (error) {
  logError('Supabase 모듈 로드 실패:', error);
  // 기본 더미 객체 생성 (오류 방지용)
  db = {
    supabase: null, // supabase 클라이언트 참조 추가
    testConnection: async () => ({ success: false, error: '모듈 로드 실패' }),
    createSchema: async () => false,
    getMemosFromDb: async () => ({ success: false, memos: [], error: '데이터베이스 연결 실패' }),
    getCategoriesFromDb: async () => ({ success: false, categories: [], error: '데이터베이스 연결 실패' }),
    getTagsFromDb: async () => ({ success: false, tags: [], error: '데이터베이스 연결 실패' }),
    saveMemoToDb: async () => ({ success: false, error: '데이터베이스 연결 실패' }),
    signInWithGoogle: async () => ({ success: false, error: '데이터베이스 연결 실패' }),
    signOut: async () => ({ success: false, error: '데이터베이스 연결 실패' }),
    getCurrentUser: async () => ({ success: false, user: null, error: '데이터베이스 연결 실패' })
  };

  // 데이터베이스 연결 실패 알림 표시 (애플리케이션 시작 후)
  if (app.isReady()) {
    dialog.showErrorBox('데이터베이스 연결 실패', '애플리케이션이 Supabase 데이터베이스에 연결할 수 없습니다. 오프라인 모드로 작동합니다.');
  } else {
    app.once('ready', () => {
      dialog.showErrorBox('데이터베이스 연결 실패', '애플리케이션이 Supabase 데이터베이스에 연결할 수 없습니다. 오프라인 모드로 작동합니다.');
    });
  }
}

// 애플리케이션 스키마 정의 및 기본값 설정
const schema = {
  memos: {
    type: 'array',
    default: []
  },
  categories: {
    type: 'array',
    default: [
      { id: 1, name: '업무', color: '#4a6da7' },
      { id: 2, name: '개인', color: '#8bc34a' },
      { id: 3, name: '아이디어', color: '#ff9800' },
      { id: 4, name: '할일', color: '#9c27b0' }
    ]
  },
  tags: {
    type: 'array',
    default: ['중요', '긴급', '후속조치', '참고']
  },
  settings: {
    type: 'object',
    properties: {
      theme: { type: 'string', enum: ['light', 'dark', 'system'], default: 'system' },
      autoStart: { type: 'boolean', default: false },
      fontSize: { type: 'number', default: 14 },
      showNotifications: { type: 'boolean', default: true },
      syncEnabled: { type: 'boolean', default: false },
      syncEmail: { type: 'string', default: '' },
      syncPassword: { type: 'string', default: '' },
      globalShortcut: { type: 'string', default: 'CommandOrControl+Shift+M' },
      markdownToolbar: { type: 'boolean', default: true },
      alwaysOnTop: { type: 'boolean', default: false }
    },
    default: {
      theme: 'system',
      autoStart: false,
      fontSize: 14,
      showNotifications: true,
      syncEnabled: false,
      syncEmail: '',
      syncPassword: '',
      globalShortcut: 'CommandOrControl+Shift+M',
      markdownToolbar: true,
      alwaysOnTop: false
    }
  },
  auth: {
    type: 'object',
    properties: {
      user: { type: ['object', 'null'] },  // null을 허용하도록 타입 배열로 변경
      isLoggedIn: { type: 'boolean', default: false },
      skipLogin: { type: 'boolean', default: false }
    },
    default: {
      user: null,
      isLoggedIn: false,
      skipLogin: false
    }
  }
};

// 데이터 저장소 초기화
const store = new Store({ schema });

// 앱 변수 초기화
let panelWindow = null; // 슬라이드 패널 윈도우
let tray = null;
let aboutWindow = null;
let settingsWindow = null;
let loginWindow = null;
app.isQuitting = false;

// 프로토콜 등록 (딥 링크)
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('memowave', process.execPath, [path.resolve(process.argv[1])]);
    console.log(`개발 모드에서 'memowave' 프로토콜 등록 시도.`);
  }
} else {
  app.setAsDefaultProtocolClient('memowave');
  console.log(`프로덕션 모드에서 'memowave' 프로토콜 등록.`);
}

// 단일 인스턴스 잠금 설정
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  // 두 번째 인스턴스 실행 및 URL 처리를 위한 핸들러
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    console.log('메인 프로세스: 두 번째 인스턴스 실행 감지. 명령줄:', commandLine);
    console.log('SECOND-INSTANCE received:', JSON.stringify(commandLine));

    // 이미 로그인 창이 열려있다면 포커스
    if (loginWindow && !loginWindow.isDestroyed()) {
      if (loginWindow.isMinimized()) loginWindow.restore();
      loginWindow.focus();
      console.log('메인 프로세스: 기존 로그인 창에 포커스 설정됨');
    } else if (panelWindow && !panelWindow.isDestroyed()) { // 또는 메인 앱 창이 있다면
      if (panelWindow.isMinimized()) panelWindow.restore();
      if (!panelWindow.isVisible()) {
        positionAndShowPanel();
      }
      panelWindow.focus();
      console.log('메인 프로세스: 기존 패널 창에 포커스 설정됨');
    }

    // commandLine에서 URL 처리 (Windows에서 딥링크로 시작된 경우)
    console.log('메인 프로세스: URL 검색 중...');
    for (const arg of commandLine) {
      console.log('메인 프로세스: 검사 중인 인자:', arg);
      if (arg.startsWith('memowave://')) {
        console.log('메인 프로세스: memowave:// URL 감지:', arg);
        console.log('메인 프로세스: memowave:// URL 길이:', arg.length);
        console.log('메인 프로세스: memowave:// URL 포함 내용:', arg.includes('login-callback') ? '로그인 콜백 포함' : '로그인 콜백 미포함');
        handleOAuthCallback(arg);
        break;
      }
    }
  });
}

const PANEL_WIDTH = 350; // 패널 너비 (조정 가능)

// 활성화된 위젯 창들을 관리하는 객체
// key: memoId, value: BrowserWindow instance
const activeWidgetWindows = new Map();

// 알림 일정 관리
const reminderTimers = new Map();

// 메모 데이터 구조 변경을 위한 마이그레이션 함수
function migrateDataIfNeeded() {
  let memos = store.get('memos', []);
  let needsMigration = false;

  memos = memos.map(memo => {
    // Object.hasOwn 사용으로 변경 (린터 오류 수정)
    if (!Object.hasOwn(memo, 'categoryId')) {
      memo.categoryId = null;
      needsMigration = true;
    }
    if (!Object.hasOwn(memo, 'tags')) {
      memo.tags = [];
      needsMigration = true;
    }
    if (!Object.hasOwn(memo, 'color')) {
      memo.color = null;
      needsMigration = true;
    }
    if (!Object.hasOwn(memo, 'priority')) {
      memo.priority = 0; // 0: 일반, 1: 중요, 2: 긴급
      needsMigration = true;
    }
    if (!Object.hasOwn(memo, 'reminder')) {
      memo.reminder = null;
      needsMigration = true;
    }
    if (!Object.hasOwn(memo, 'images')) {
      memo.images = [];
      needsMigration = true;
    }
    return memo;
  });

  if (needsMigration) {
    store.set('memos', memos);
    console.log('메모 데이터 마이그레이션 완료');
  }
}

// SVG 문자열을 Data URL로 변환하는 헬퍼 함수
function generateSvgDataUrl(fillColor) {
    const svgString = `
        <svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
          <path d="M3 1 H13 V13 L10.5 11.5 L8 13 L5.5 11.5 L3 13 Z M3 1 L5 3 L3 3 Z" fill="${fillColor}"/>
        </svg>
    `;
    return `data:image/svg+xml;base64,${Buffer.from(svgString).toString('base64')}`;
}

// 트레이 아이콘 생성 함수
function createTray() {
    let trayIconPath = path.join(__dirname, 'assets', 'tray-icon.svg'); // SVG 파일 경로

    // SVG 파일을 nativeImage로 변환
    let trayIcon;
    if (fs.existsSync(trayIconPath)) {
        try {
            // SVG는 DataURL로 변환하여 nativeImage로 만드는 것이 안정적일 수 있습니다.
            const svgData = fs.readFileSync(trayIconPath, 'utf-8');
            const dataUrl = `data:image/svg+xml;base64,${Buffer.from(svgData).toString('base64')}`;
            trayIcon = nativeImage.createFromDataURL(dataUrl);

            // macOS에서는 template image로 설정하면 테마에 맞게 자동 조절
            if (process.platform === 'darwin') {
                trayIcon = trayIcon.resize({ width: 16, height: 16 }); // macOS 적정 크기
                // tray.setTemplateImage(trayIcon); // 아래에서 tray 객체 생성 후 설정
            } else {
                // 다른 OS에서는 필요에 따라 크기 조절
                trayIcon = trayIcon.resize({ width: 16, height: 16 }); // 16x16 또는 32x32
            }

        } catch (error) {
            console.error("SVG 트레이 아이콘 로드 실패:", error);
            trayIcon = nativeImage.createEmpty(); // 로드 실패 시 빈 아이콘
        }
    } else {
        console.error(`트레이 아이콘 파일을 찾을 수 없습니다: ${trayIconPath}`);
        trayIcon = nativeImage.createEmpty(); // 파일 없을 시 빈 아이콘
    }


    if (tray && !tray.isDestroyed()) { // 기존 트레이가 있다면 이미지 업데이트
        tray.setImage(trayIcon);
        if (process.platform === 'darwin' && trayIcon.isTemplateImage()) { // macOS template image 설정
            // tray.setTemplateImage(trayIcon); // 이미 setImage로도 TemplateImage 속성이 유지될 수 있음
        }
    } else { // 기존 트레이가 없다면 새로 생성
        tray = new Tray(trayIcon);
        if (process.platform === 'darwin') {
            // tray.setTemplateImage(trayIcon); // macOS에서 템플릿 이미지로 설정
        }
    }


    tray.setToolTip('MemoWave - 스마트 메모 앱');
    const contextMenu = Menu.buildFromTemplate([
        {
            label: '패널 열기/닫기',
            click: () => { togglePanelVisibility(); }
        },
        { type: 'separator' },
        {
            label: '설정',
            click: () => { openSettingsWindow(); }
        },
        {
            label: '앱 정보',
            click: () => { openAboutWindow(); }
        },
        { type: 'separator' },
        {
            label: '종료',
            click: () => {
                app.isQuitting = true;
                app.quit();
            }
        }
    ]);
    tray.setContextMenu(contextMenu);

    tray.on('click', () => {
        togglePanelVisibility();
    });


    // 테마 변경 감지 (선택적이지만, 만약 테마별 다른 아이콘을 쓰고 싶다면)
    nativeTheme.on('updated', () => {
        if (tray && !tray.isDestroyed()) {
            // 이 부분은 테마에 따라 아이콘을 동적으로 바꾸고 싶을 때 구현합니다.
            // 지금은 항상 흰색 아이콘을 사용하므로, 특별히 호출할 필요는 없을 수 있습니다.
            // 하지만 만약 라이트 테마에서 검은색 아이콘을 쓰고 싶다면 여기서 로직 추가.
            // 예: tray.setImage(getCorrectIconForTheme());
            console.log(`테마 변경됨. 현재 다크모드: ${nativeTheme.shouldUseDarkColors}`);
        }
    });
}

// 설정 창 열기 함수
function openSettingsWindow() {
    // 이미 열려있으면 포커스
    if (settingsWindow) {
        settingsWindow.focus();
        return;
    }

    settingsWindow = new BrowserWindow({
        width: 600,
        height: 700,
        title: '설정',
        icon: path.join(__dirname, 'assets', 'try_icon.png'),  // 변경: 새 아이콘 사용
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    settingsWindow.loadFile(path.join(__dirname, 'settings.html'));
    // settingsWindow.webContents.openDevTools({ mode: 'detach' });

    settingsWindow.on('closed', () => {
        settingsWindow = null;
    });
}

// 앱 정보 창 열기 함수
function openAboutWindow() {
    if (aboutWindow) {
        aboutWindow.focus();
        return;
    }

    aboutWindow = new BrowserWindow({
        width: 400,
        height: 500,
        resizable: false,
        title: 'MemoWave 정보',
        webPreferences: {
            preload: path.join(__dirname, 'preload-about.js'),
            contextIsolation: true,
            nodeIntegration: false
        },
        icon: tryIconPath // 변경된 아이콘 적용
    });

    aboutWindow.loadFile(path.join(__dirname, 'about.html'));

    aboutWindow.on('closed', () => {
        aboutWindow = null;
    });
}

function createPanelWindow() {
    panelWindow = new BrowserWindow({
        width: PANEL_WIDTH,
        height: screen.getPrimaryDisplay().workAreaSize.height,
        x: screen.getPrimaryDisplay().workAreaSize.width - PANEL_WIDTH,
        y: 0,
        frame: false,
        resizable: false,
        skipTaskbar: true,
        show: false,
        webPreferences: {
            preload: path.join(__dirname, 'preload-panel.js'),
            nodeIntegration: false,
            contextIsolation: true
        },
        icon: appIconPath // 메인 아이콘 유지
    });

    panelWindow.loadFile('panel.html');

    // 개발 모드에서는 개발자 도구 표시
    if (process.argv.includes('--dev')) {
        panelWindow.webContents.openDevTools({ mode: 'detach' });
    }

    // 창을 닫을 때 이벤트
    panelWindow.on('closed', () => {
        panelWindow = null;
    });

    // 초기 상태는 숨김
    if (panelWindow) {
        panelWindow.hide();
    }

    // IPC 이벤트 핸들러 등록
    setupPanelIpcHandlers();
}

// 이미 등록된 IPC 핸들러 이름을 추적하기 위한 전역 Set
const registeredHandlers = new Set();

// 이미 등록된 핸들러 제거를 위한 헬퍼 함수
const safelyRegisterHandler = (channel, handler) => {
  try {
    // 이미 등록된 핸들러가 있다면 제거 시도
    if (registeredHandlers.has(channel)) {
      console.log(`[메인 프로세스] 기존 '${channel}' 핸들러 제거 시도`);
      ipcMain.removeHandler(channel);
    }

    // 새 핸들러 등록
    ipcMain.handle(channel, handler);
    registeredHandlers.add(channel);
    console.log(`[메인 프로세스] '${channel}' 핸들러 등록 완료`);
  } catch (error) {
    console.error(`[메인 프로세스] '${channel}' 핸들러 등록 오류:`, error);
  }
};

// 패널 관련 IPC 핸들러 설정
function setupPanelIpcHandlers() {
  // 저장된 메모 가져오기
  safelyRegisterHandler('get-memos', async () => {
    try {
      // DB에서 메모 로드 시도
      const result = await db.getMemosFromDb();

      if (result.success) {
        // DB에서 성공적으로 로드했으면 그 결과 반환
        return result.memos;
      } else {
        // DB 로드 실패 시 로컬 스토리지에서 로드
        console.warn('[메인 프로세스] DB에서 메모 로드 실패, 로컬 스토리지 사용:', result.error);
        return store.get('memos', []);
      }
    } catch (error) {
      console.error('[메인 프로세스] 메모 로드 오류:', error);
      return store.get('memos', []);
    }
  });

  // 인증 상태 확인
  safelyRegisterHandler('get-auth-status', async () => {
    const auth = store.get('auth', { isLoggedIn: false, user: null });

    // 세션이 유효한지 검증
    if (auth.isLoggedIn && auth.user) {
      try {
        const userResult = await db.getCurrentUser();
        if (userResult.success && userResult.user) {
          // 최신 사용자 정보 반환
          return {
            isLoggedIn: true,
            user: userResult.user
          };
        } else {
          // 세션이 만료된 경우
          return { isLoggedIn: false, user: null };
        }
      } catch (error) {
        console.error('인증 상태 확인 오류:', error);
        return { isLoggedIn: false, user: null };
      }
    }

    return auth;
  });

  // 메모 저장하기
  safelyRegisterHandler('save-memos', async (event, memos) => {
    // 메모 데이터 정제 (카테고리 ID 처리)
    const sanitizedMemos = memos.map(memo => {
      // 카테고리 ID가 문자열인 경우 숫자로 변환
      if (typeof memo.categoryId === 'string' && memo.categoryId.trim() !== '') {
        const parsedId = Number.parseInt(memo.categoryId, 10);
        if (!Number.isNaN(parsedId)) {
          memo.categoryId = parsedId;
          console.log(`[메인 프로세스] 메모 ID ${memo.id}의 카테고리 ID를 숫자로 변환: ${parsedId}`);
        } else {
          memo.categoryId = null;
          console.log(`[메인 프로세스] 메모 ID ${memo.id}의 카테고리 ID 변환 실패, null로 설정`);
        }
      }

      // 특수 문자열 값을 null로 처리
      if (memo.categoryId === '[NULL]' || memo.categoryId === 'null' || memo.categoryId === '') {
        memo.categoryId = null;
        console.log(`[메인 프로세스] 메모 ID ${memo.id}의 categoryId '[NULL]' 값을 null로 처리`);
      }

      // undefined 값을 null로 처리
      if (typeof memo.categoryId === 'undefined') {
        memo.categoryId = null;
        console.log(`[메인 프로세스] 메모 ID ${memo.id}의 undefined categoryId를 null로 처리`);
      }

      return memo;
    });

    console.log('[메인 프로세스] 저장 전 메모 데이터 샘플:',
      sanitizedMemos.slice(0, 3).map(m => ({
        id: m.id,
        text: m.text.substring(0, 15),
        categoryId: m.categoryId,
        categoryIdType: typeof m.categoryId
      }))
    );

    // 로컬 스토리지에 저장
    store.set('memos', sanitizedMemos);

    // DB에 저장 시도
    try {
      // 각 메모를 DB에 저장
      for (const memo of sanitizedMemos) {
        const result = await db.saveMemoToDb(memo);
        if (!result.success) {
          console.error(`[메인 프로세스] 메모 ID ${memo.id} 저장 실패:`, result.error);
        }
      }
    } catch (error) {
      console.error('[메인 프로세스] DB에 메모 저장 실패:', error);
      // 실패해도 로컬에는 저장되었으므로 계속 진행
    }

    // 위젯으로 표시된 메모들 업데이트
    for (const memo of sanitizedMemos) {
      if (memo.reminder) {
        scheduleReminder(memo);
      }

      // 위젯 창이 있으면 내용 업데이트
      if (activeWidgetWindows.has(memo.id)) {
        const widgetWindow = activeWidgetWindows.get(memo.id);
        if (widgetWindow && !widgetWindow.isDestroyed()) {
          widgetWindow.webContents.send('update-widget-content', memo);
        }
      }
    }

    return true;
  });

  // 설정 가져오기
  safelyRegisterHandler('get-settings', async () => {
    return store.get('settings');
  });

  // 카테고리 가져오기
  safelyRegisterHandler('get-categories', async () => {
    try {
      // DB에서 카테고리 로드 시도
      const result = await db.getCategoriesFromDb();

      if (result.success) {
        // DB에서 성공적으로 로드했으면 그 결과 반환
        return result.categories;
      } else {
        // DB 로드 실패 시 로컬 스토리지에서 로드
        console.warn('DB에서 카테고리 로드 실패, 로컬 스토리지 사용:', result.error);
        return store.get('categories', []);
      }
    } catch (error) {
      console.error('카테고리 로드 오류:', error);
      return store.get('categories', []);
    }
  });

  // 카테고리 저장하기
  safelyRegisterHandler('save-categories', async (event, categories) => {
    // 로컬 스토리지에 저장
    store.set('categories', categories);

    // DB에 저장 시도
    try {
      await db.saveCategoriesToDb(categories);
    } catch (error) {
      console.error('DB에 카테고리 저장 실패:', error);
      // 실패해도 로컬에는 저장되었으므로 계속 진행
    }

    return true;
  });

  // 태그 가져오기
  safelyRegisterHandler('get-tags', async () => {
    try {
      // DB에서 태그 로드 시도
      const result = await db.getTagsFromDb();

      if (result.success) {
        // DB에서 성공적으로 로드했으면 그 결과 반환
        return result.tags;
      } else {
        // DB 로드 실패 시 로컬 스토리지에서 로드
        console.warn('DB에서 태그 로드 실패, 로컬 스토리지 사용:', result.error);
        return store.get('tags', []);
      }
    } catch (error) {
      console.error('태그 로드 오류:', error);
      return store.get('tags', []);
    }
  });

  // 태그 저장하기
  safelyRegisterHandler('save-tags', async (event, tags) => {
    // 로컬 스토리지에 저장
    store.set('tags', tags);

    // DB에 저장 시도
    try {
      await db.saveTagsToDb(tags);
    } catch (error) {
      console.error('DB에 태그 저장 실패:', error);
      // 실패해도 로컬에는 저장되었으므로 계속 진행
    }

    return true;
  });

  // 데이터베이스에서 메모 삭제
  safelyRegisterHandler('delete-memo-from-db', async (event, memoId) => {
    try {
      const result = await db.deleteMemoFromDb(memoId);
      return result;
    } catch (error) {
      console.error('DB에서 메모 삭제 실패:', error);
      return { success: false, error: error.message };
    }
  });

  // 위젯 생성
  safelyRegisterHandler('create-widget', async (event, memo) => {
    createWidgetWindow(memo);
    return true;
  });

  // 이미지 첨부를 위한 파일 선택 대화상자
  safelyRegisterHandler('select-image', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        { name: '이미지', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'] }
      ]
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    // 선택한 이미지 파일 경로
    const imagePath = result.filePaths[0];

    // 애플리케이션 데이터 디렉토리에 이미지 폴더가 없으면 생성
    const imageDir = path.join(app.getPath('userData'), 'images');
    if (!fs.existsSync(imageDir)) {
      fs.mkdirSync(imageDir, { recursive: true });
    }

    // 고유 파일명 생성 (타임스탬프 + 원본 파일명)
    const timestamp = Date.now();
    const originalFilename = path.basename(imagePath);
    const newFilename = `${timestamp}-${originalFilename}`;
    const newPath = path.join(imageDir, newFilename);

    // 파일 복사
    try {
      fs.copyFileSync(imagePath, newPath);
      return {
        path: newPath,
        filename: newFilename,
        url: `file://${newPath.replace(/\\/g, '/')}`
      };
    } catch (error) {
      console.error('이미지 복사 오류:', error);
      return null;
    }
  });

  // 메모 데이터 내보내기
  safelyRegisterHandler('export-data', async () => {
    const result = await dialog.showSaveDialog({
      title: '메모 데이터 내보내기',
      defaultPath: path.join(app.getPath('documents'), 'memowave-backup.json'),
      filters: [
        { name: 'JSON 파일', extensions: ['json'] }
      ]
    });

    if (result.canceled || !result.filePath) {
      return { success: false, message: '내보내기가 취소되었습니다.' };
    }

    try {
      const data = {
        memos: store.get('memos', []),
        categories: store.get('categories', []),
        tags: store.get('tags', [])
      };

      fs.writeFileSync(result.filePath, JSON.stringify(data, null, 2), 'utf-8');
      return { success: true, message: '데이터가 성공적으로 내보내졌습니다.' };
    } catch (error) {
      console.error('데이터 내보내기 오류:', error);
      return { success: false, message: '내보내기 중 오류가 발생했습니다: ' + error.message };
    }
  });

  // 메모 데이터 가져오기
  safelyRegisterHandler('import-data', async () => {
    const result = await dialog.showOpenDialog({
      title: '메모 데이터 가져오기',
      properties: ['openFile'],
      filters: [
        { name: 'JSON 파일', extensions: ['json'] }
      ]
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, message: '가져오기가 취소되었습니다.' };
    }

    try {
      const filePath = result.filePaths[0];
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(fileContent);

      // 기본 데이터 구조 확인
      if (!data.memos || !Array.isArray(data.memos)) {
        return { success: false, message: '잘못된 데이터 형식입니다.' };
      }

      // 데이터 저장
      store.set('memos', data.memos);

      if (data.categories && Array.isArray(data.categories)) {
        store.set('categories', data.categories);
      }

      if (data.tags && Array.isArray(data.tags)) {
        store.set('tags', data.tags);
      }

      // 알림 일정 재설정
      setupReminderSystem();

      return { success: true, message: '데이터가 성공적으로 가져와졌습니다.' };
    } catch (error) {
      console.error('데이터 가져오기 오류:', error);
      return { success: false, message: '가져오기 중 오류가 발생했습니다: ' + error.message };
    }
  });

  // 마크다운 변환
  safelyRegisterHandler('convert-markdown', async (event, text) => {
    try {
      return marked.parse(text);
    } catch (error) {
      console.error('마크다운 변환 오류:', error);
      return text;
    }
  });

  // 위젯 상태 업데이트 핸들러 추가
  safelyRegisterHandler('update-widget-status', async (event, { memoId, isWidget }) => {
    console.log(`[메인 프로세스] 메모 ID ${memoId}의 위젯 상태를 ${isWidget}로 업데이트`);

    try {
      // DB에 상태 변경 적용
      if (db && db.supabase) {
        const { data, error } = await db.supabase
          .from('memos')
          .update({ is_widget: isWidget })
          .eq('id', memoId);

        if (error) {
          console.error('[메인 프로세스] 위젯 상태 DB 업데이트 오류:', error);
        } else {
          console.log('[메인 프로세스] 위젯 상태 DB 업데이트 성공');
        }
      }

      // 로컬 저장소에도 상태 변경 적용
      const memos = store.get('memos', []);
      const updatedMemos = memos.map(memo => {
        if (memo.id === memoId) {
          console.log(`[메인 프로세스] 로컬 저장소에서 메모 ID ${memoId}의 isWidget 속성을 ${isWidget}로 업데이트`);
          return { ...memo, isWidget };
        }
        return memo;
      });
      store.set('memos', updatedMemos);

      return { success: true };
    } catch (error) {
      console.error('[메인 프로세스] 위젯 상태 업데이트 오류:', error);
      return { success: false, error: error.message };
    }
  });
}

// === 새 위젯 창 생성 함수 ===
function createWidgetWindow(memo) {
    if (activeWidgetWindows.has(memo.id)) {
        activeWidgetWindows.get(memo.id).focus();
        return;
    }

    const widgetWindow = new BrowserWindow({
        width: memo.widgetSize ? memo.widgetSize.width : 250, // 저장된 크기 또는 기본값
        height: memo.widgetSize ? memo.widgetSize.height : 150,
        x: memo.widgetPosition ? memo.widgetPosition.x : undefined, // 저장된 위치 또는 기본값
        y: memo.widgetPosition ? memo.widgetPosition.y : undefined,
        frame: false,        // 테두리 없는 창
        transparent: true,   // 배경 투명 (CSS로 배경색 지정)
        resizable: true,
        movable: true,
        show: false,         // 로드 후 표시
        skipTaskbar: true,   // 작업 표시줄에는 표시 안 함 (선택)
        alwaysOnTop: false,  // 필요에 따라 true로 변경
        webPreferences: {
            preload: path.join(__dirname, 'preload-widget.js'),
            contextIsolation: true,
            nodeIntegration: false,
            additionalArguments: [`--memo-id=${memo.id}`], // 메모 ID 전달
        },
    });

    widgetWindow.loadFile(path.join(__dirname, 'widget.html'));

    // widgetWindow.webContents.openDevTools({ mode: 'detach' });

    widgetWindow.once('ready-to-show', () => {
        widgetWindow.show();
        // 렌더러에 메모 데이터 전달 (ID 외에 초기 내용 등)
        widgetWindow.webContents.send('initialize-widget', memo);
    });

    widgetWindow.on('moved', () => { // 창 이동 시 위치 저장
        if (!widgetWindow.isDestroyed()) {
            const position = widgetWindow.getPosition();
            // IPC를 통해 패널 또는 메인에 알려서 memo 데이터 업데이트 및 저장
            panelWindow?.webContents.send('update-memo-widget-state', {
                id: memo.id,
                widgetPosition: { x: position[0], y: position[1] }
            });
        }
    });

    widgetWindow.on('resized', () => { // 창 크기 변경 시 저장
        if (!widgetWindow.isDestroyed()) {
            const size = widgetWindow.getSize();
             panelWindow?.webContents.send('update-memo-widget-state', {
                id: memo.id,
                widgetSize: { width: size[0], height: size[1] }
            });
        }
    });

    widgetWindow.on('closed', () => {
        activeWidgetWindows.delete(memo.id);
        // 패널에 알려서 isWidget 상태를 false로 변경하도록 요청
        if (panelWindow && !panelWindow.isDestroyed()) {
            panelWindow.webContents.send('widget-closed', memo.id);
        }
    });

    activeWidgetWindows.set(memo.id, widgetWindow);
}

// === 앱 시작 시 저장된 위젯 복원 ===
async function restoreWidgets() {
    try {
        const memos = store.get('memos', []);
        memos.forEach(memo => {
            if (memo.isWidget) {
                createWidgetWindow(memo);
            }
        });
    } catch (error) {
        console.error('Failed to restore widgets:', error);
    }
}

// 자동 업데이트 설정
function setupAutoUpdater() {
  // 개발 환경에서는 자동 업데이트 비활성화
  if (process.env.NODE_ENV === 'development') {
    return;
  }

  // 업데이트 이벤트 처리
  autoUpdater.on('checking-for-update', () => {
    console.log('업데이트 확인 중...');
  });

  autoUpdater.on('update-available', (info) => {
    console.log('업데이트 가능:', info);
    // 사용자에게 업데이트 가능 알림
    if (panelWindow) {
      panelWindow.webContents.send('update-available', info);
    }
  });

  autoUpdater.on('update-not-available', () => {
    console.log('현재 최신 버전입니다.');
  });

  autoUpdater.on('error', (err) => {
    console.error('업데이트 오류:', err);
  });

  autoUpdater.on('download-progress', (progressObj) => {
    const logMessage = `다운로드 속도: ${progressObj.bytesPerSecond} - 진행률: ${progressObj.percent}% (${progressObj.transferred}/${progressObj.total})`;
    console.log(logMessage);
    if (panelWindow) {
      panelWindow.webContents.send('update-progress', progressObj);
    }
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log('업데이트 다운로드 완료:', info);
    // 사용자에게 업데이트 완료 알림 및 재시작 묻기
    if (panelWindow) {
      panelWindow.webContents.send('update-downloaded', info);
    }

    dialog.showMessageBox({
      type: 'info',
      title: '업데이트 준비 완료',
      message: '새 버전이 다운로드되었습니다. 지금 재시작하여 업데이트를 적용하시겠습니까?',
      buttons: ['네, 지금 재시작합니다', '아니오, 나중에 할게요']
    }).then(({ response }) => {
      if (response === 0) {
        autoUpdater.quitAndInstall();
      }
    });
  });

  // 1시간마다 업데이트 확인
  setInterval(() => {
    autoUpdater.checkForUpdates();
  }, 60 * 60 * 1000);

  // 앱 시작 시 업데이트 확인
  autoUpdater.checkForUpdates();
}

// 애플리케이션 초기화 함수
async function initializeApp() {
    // 데이터 마이그레이션 실행
    migrateDataIfNeeded();

    // OAuth 콜백을 위한 로컬 HTTP 서버 시작
    try {
        console.log('[메인 프로세스] OAuth 콜백용 로컬 HTTP 서버 시작 시도');
        localCallbackServer = await startLocalCallbackServer();
        console.log('[메인 프로세스] OAuth 콜백용 로컬 HTTP 서버 시작 성공');
    } catch (error) {
        console.error('[메인 프로세스] OAuth 콜백용 로컬 HTTP 서버 시작 실패:', error);
    }

    // Auth IPC 핸들러 설정 (한 번만 호출)
    setupAuthIpcHandlers();

    // 데이터베이스 연결 테스트 및 초기화
    try {
        const isConnected = await db.testConnection();
        // UTF-8로 출력하기 위한 Buffer 사용 (한글 깨짐 방지)
        const successMsg = Buffer.from(`데이터베이스 연결 상태: ${isConnected ? '성공' : '실패'}`, 'utf8').toString();
        console.log(successMsg);

        if (isConnected) {
            // 연결 성공 시 스키마 생성 시도
            console.log('데이터베이스 스키마 초기화 시작...');

            // 먼저 카테고리 테이블 상태 확인
            try {
                // PostgreSQL 직접 연결로 테이블 체크
                const client = await db.pool.connect();
                try {
                    // 카테고리 테이블 존재 여부 확인
                    const tableCheck = await client.query(
                        "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'categories')"
                    );

                    const tableExists = tableCheck.rows[0].exists;
                    console.log(`카테고리 테이블 존재 여부: ${tableExists}`);

                    // 테이블이 존재하면 데이터 확인
                    if (tableExists) {
                        const dataCheck = await client.query('SELECT COUNT(*) FROM categories');
                        const count = parseInt(dataCheck.rows[0].count);
                        console.log(`카테고리 테이블 데이터 수: ${count}`);

                        // 데이터가 없으면 초기 데이터 삽입
                        if (count === 0) {
                            console.log('카테고리 초기 데이터 삽입 시도...');
                            await client.query(`
                                INSERT INTO categories (id, name, color)
                                VALUES
                                    (1, '업무', '#4a6da7'),
                                    (2, '개인', '#8bc34a'),
                                    (3, '아이디어', '#ff9800'),
                                    (4, '할일', '#9c27b0')
                                ON CONFLICT (id) DO NOTHING
                            `);
                        }
                    } else {
                        // 테이블이 없으면 스키마 생성 시도
                        console.log('카테고리 테이블이 없습니다. 전체 스키마 생성 시도...');
                    }
                } finally {
                    client.release();
                }
            } catch (tableCheckError) {
                console.error('테이블 상태 확인 오류:', tableCheckError);
            }

            // 전체 스키마 생성 시도
            const schemaCreated = await db.createSchema();
            const schemaMsg = Buffer.from(`스키마 생성 상태: ${schemaCreated ? '성공' : '이미 존재하거나 실패'}`, 'utf8').toString();
            console.log(schemaMsg);
        } else {
            // 연결 실패 시 메시지 출력
            console.error('데이터베이스 연결에 실패했습니다. 오프라인 모드로 작동합니다.');

            // 사용자에게 알림
            dialog.showMessageBox({
                type: 'warning',
                title: '데이터베이스 연결 오류',
                message: '데이터베이스 연결에 실패했습니다.',
                detail: '앱이 오프라인 모드로 작동합니다. 일부 기능이 제한될 수 있습니다.',
                buttons: ['확인']
            });
        }
    } catch (error) {
        const errorMsg = Buffer.from(`데이터베이스 연결/설정 오류: ${error}`, 'utf8').toString();
        console.error(errorMsg);

        // 오류 대화상자 표시
        dialog.showErrorBox(
            '데이터베이스 초기화 오류',
            '데이터베이스 연결 또는 설정 중 오류가 발생했습니다. 오프라인 모드로 작동합니다.'
        );
    }

    // 트레이 아이콘 생성
    createTray();

    // 로그인 상태 확인
    const isLoggedIn = await checkLoginStatus();
    if (!isLoggedIn) {
        // 로그인 창 표시
        createLoginWindow();
    } else {
        // 패널 윈도우 생성
        createPanelWindow();

        // 이전 위젯 상태 복원
        await restoreWidgets();
    }

    // 자동 업데이트 설정
    setupAutoUpdater();

    // 알림 설정
    setupNotifications();

    // 글로벌 단축키 설정
    setupGlobalShortcut();

    // 앱이 정상 종료되었을 때 위젯 상태를 저장 및 리소스 정리
    app.on('will-quit', () => {
        // 글로벌 단축키 등록 해제
        if (globalShortcut.isRegistered('CommandOrControl+Shift+M')) {
            globalShortcut.unregister('CommandOrControl+Shift+M');
        }

        // 로컬 HTTP 서버 종료
        if (localCallbackServer) {
            console.log('[메인 프로세스] 로컬 HTTP 서버 종료');
            localCallbackServer.close();
            localCallbackServer = null;
        }
    });

    // 시스템 테마 변경 감지
    nativeTheme.on('updated', () => {
        applySettings(store.get('settings'));
    });

    // URI 프로토콜 처리 이벤트
    app.on('open-url', (event, url) => {
        event.preventDefault();
        console.log('메인 프로세스: open-url 이벤트 발생:', url);
        console.log('OPEN-URL received:', url);
        console.log('URL 타입:', typeof url, '길이:', url.length);
        console.log('memowave:// 프로토콜 포함 여부:', url.includes('memowave://'));
        console.log('login-callback 포함 여부:', url.includes('login-callback'));
        console.log('access_token 포함 여부:', url.includes('access_token'));
        handleOAuthCallback(url);
    });
}

// 알림 시스템 설정
function setupNotifications() {
    // 알림 권한 확인 (macOS에서만 필요)
    if (process.platform === 'darwin' && Notification.isSupported()) {
        Notification.requestPermission().then(permission => {
            console.log('알림 권한 상태:', permission);
        });
    }

    // 알림 스케줄링 기능 설정
    setupReminderSystem();
}

// 리마인더 시스템 설정
function setupReminderSystem() {
    // 기존 타이머 정리
    for (const timerId of reminderTimers.values()) {
        clearTimeout(timerId);
    }
    reminderTimers.clear();

    // 저장된 모든 메모 불러오기
    const memos = store.get('memos', []);

    // 리마인더가 설정된 메모를 찾아 타이머 설정
    memos.forEach(memo => {
        if (memo.reminder && new Date(memo.reminder) > new Date()) {
            scheduleReminder(memo);
        }
    });
}

// 리마인더 일정 설정
function scheduleReminder(memo) {
    if (!memo.reminder) return;

    const reminderTime = new Date(memo.reminder);
    const now = new Date();

    if (reminderTime > now) {
        const timeUntilReminder = reminderTime.getTime() - now.getTime();

        // 기존 타이머가 있으면 제거
        if (reminderTimers.has(memo.id)) {
            clearTimeout(reminderTimers.get(memo.id));
        }

        // 새 타이머 설정
        const timerId = setTimeout(() => {
            showReminderNotification(memo);
            reminderTimers.delete(memo.id);
        }, timeUntilReminder);

        reminderTimers.set(memo.id, timerId);
    }
}

// 리마인더 알림 표시
function showReminderNotification(memo) {
    const settings = store.get('settings');
    if (!settings.showNotifications) return;

    const title = '메모 알림';
    let body = memo.text;

    // 긴 텍스트 자르기
    if (body.length > 100) {
        body = body.substring(0, 97) + '...';
    }

    const notification = new Notification({
        title,
        body,
        icon: path.join(__dirname, 'assets', 'icon.png')
    });

    notification.show();

    notification.on('click', () => {
        // 패널이 없으면 생성
        if (!panelWindow) {
            createPanelWindow();
        }

        // 패널 표시 후 해당 메모로 스크롤
        panelWindow.webContents.send('show-panel-and-focus-memo', memo.id);
    });
}

// 전역 단축키 설정
function setupGlobalShortcut() {
    const settings = store.get('settings');
    const shortcutKey = settings.globalShortcut || 'CommandOrControl+Shift+M';

    // 기존 단축키 등록 해제
    if (globalShortcut.isRegistered(shortcutKey)) {
        globalShortcut.unregister(shortcutKey);
    }

    // 새 단축키 등록
    try {
        globalShortcut.register(shortcutKey, () => {
            togglePanelVisibility();
        });

        if (!globalShortcut.isRegistered(shortcutKey)) {
            console.error('전역 단축키 등록 실패');
        }
    } catch (error) {
        console.error('전역 단축키 등록 오류:', error);
    }
}

// 앱 준비 완료 이벤트
app.whenReady().then(async () => {
  console.log('앱 준비 완료');

  // Windows에서 프로토콜 핸들러 등록 강화
  if (process.platform === 'win32') {
    console.log('Windows 환경에서 프로토콜 핸들러 설정 강화');

    // 프로토콜 핸들러 등록 강화 (관리자 권한 필요할 수 있음)
    try {
      enhanceProtocolRegistration();

      // 자동 로그인 기능에 대한 안내 메시지
      const showInfoTimeout = setTimeout(() => {
        if (app.isReady()) {
          dialog.showMessageBox({
            type: 'info',
            title: '자동 로그인 안내',
            message: '구글 로그인 시 자동으로 앱으로 돌아오지 않는 경우:',
            detail: '1. 브라우저에 표시되는 URL을 복사하세요.\n2. 앱의 "URL 수동 입력" 필드에 붙여넣으세요.\n\n한 번 로그인하면 세션이 저장되어 나중에 자동으로 로그인됩니다.',
            buttons: ['확인']
          });
        }
      }, 1000);
    } catch (error) {
      console.error('프로토콜 핸들러 등록 중 오류:', error);
    }

    // 참고: Windows에서의 딥링크 처리는 'second-instance' 이벤트 핸들러에서 수행됨
    console.log('Windows에서 딥링크는 second-instance 이벤트로 처리됩니다.');
  }

  await initializeApp();
});

app.on('window-all-closed', () => {
    // 트레이 앱은 일반적으로 모든 창이 닫혀도 종료되지 않음
    // 명시적으로 종료할 때만 종료
    if (app.isQuitting) {
        if (process.platform !== 'darwin') {
            app.quit();
        }
    }
});

app.on('activate', () => {
    // macOS에서 독 아이콘 클릭 시 (보통 트레이 앱은 독 아이콘을 숨김)
    if (!panelWindow || !panelWindow.isVisible()) {
        togglePanelVisibility();
    }
});

// 설정 관련 IPC 핸들러 중 update-settings만 남깁니다.
// get-settings는 setupPanelIpcHandlers에서 이미 등록됩니다.
ipcMain.handle('update-settings', async (event, settings) => {
  try {
    store.set('settings', settings);
    // 설정 변경에 따른 앱 동작 조정
    applySettings(settings);
    return { success: true };
  } catch (error) {
    console.error('설정 저장 실패:', error);
    return { success: false, error: error.message };
  }
});

// 설정 적용 함수
function applySettings(settings) {
  // 테마 설정 적용
  if (settings.theme === 'dark') {
    nativeTheme.themeSource = 'dark';
  } else if (settings.theme === 'light') {
    nativeTheme.themeSource = 'light';
  } else {
    nativeTheme.themeSource = 'system';
  }

  // 자동 시작 설정 적용
  const autoLaunchEnabled = app.getLoginItemSettings().openAtLogin;
  if (settings.autoStart !== autoLaunchEnabled) {
    app.setLoginItemSettings({
      openAtLogin: settings.autoStart,
      path: app.getPath('exe')
    });
  }

  // 알림 관련 설정 등 필요한 경우 추가
}

// 패널 닫기 요청 (panel-renderer.js에서 호출)
ipcMain.on('close-panel', () => {
    hidePanel();
});

// 패널로부터 위젯 생성 요청
ipcMain.on('create-widget-from-panel', (event, memo) => {
    createWidgetWindow(memo);
});

// 위젯 창으로부터 내용 업데이트 요청
ipcMain.handle('update-memo-content-from-widget', async (event, { memoId, newContent }) => {
    // 패널 윈도우에 변경 알림 (패널이 열려 있다면)
    if (panelWindow && !panelWindow.isDestroyed()) {
        panelWindow.webContents.send('update-memo-from-widget', { memoId, newContent });
    }
    // 실제 파일 저장은 패널측에서 saveMemos를 호출하여 일관성 유지
    return { success: true };
});

// 위젯 창에서 "패널로 되돌리기" 또는 닫기 시 호출
ipcMain.on('return-widget-to-panel', async (event, memoId) => {
    console.log(`패널로 되돌리기 요청 수신: memoId=${memoId}, 타입=${typeof memoId}`);

    // 메모 ID가 문자열이면 숫자로 변환 (일관성 유지)
    const numericId = typeof memoId === 'string' ? Number.parseInt(memoId, 10) : memoId;

    // 이 메모가 최근에 패널로 돌아온 메모임을 전역 변수에 저장
    global.lastRestoredMemoId = numericId;

    try {
        // 1. 먼저 메모의 위젯 상태를 직접 업데이트
        if (db && db.supabase) {
            try {
                console.log(`메모 ID ${numericId}의 위젯 상태를 false로 직접 업데이트`);
                const { data, error } = await db.supabase
                    .from('memos')
                    .update({ is_widget: false })
                    .eq('id', numericId);

                if (error) {
                    console.error('위젯 상태 업데이트 DB 오류:', error);
                } else {
                    console.log('DB에서 위젯 상태 업데이트 성공');
                }
            } catch (dbError) {
                console.error('DB 작업 중 오류:', dbError);
            }
        }

        // 2. 로컬 메모 데이터 업데이트
        const memos = store.get('memos', []);
        const updatedMemos = memos.map(memo => {
            if (memo.id === numericId) {
                console.log(`로컬 저장소에서 메모 ID ${numericId}의 isWidget 속성을 false로 업데이트`);
                // 강제 노출 플래그 추가
                return { ...memo, isWidget: false, recentlyRestored: true, forceVisible: true };
            }
            return memo;
        });
        store.set('memos', updatedMemos);

        // 3. 패널이 있으면 패널에 알림
        if (panelWindow && !panelWindow.isDestroyed()) {
            console.log(`패널에 위젯 닫힘 알림 전송 (ID: ${numericId})`);

            // 패널에 강제 노출 알림 전송
            panelWindow.webContents.send('force-show-memo', numericId);

            // 여러 이벤트를 시간차를 두고 전송하여 패널이 확실히 처리하도록 함
            panelWindow.webContents.send('update-widget-status', { memoId: numericId, isWidget: false });

            setTimeout(() => {
                panelWindow.webContents.send('widget-closed', numericId);
                console.log(`지연 후 widget-closed 메시지 전송됨 (ID: ${numericId})`);
            }, 200);

            setTimeout(() => {
                panelWindow.webContents.send('show-panel-and-focus-memo', numericId);
                console.log(`지연 후 focus-memo 메시지 전송됨 (ID: ${numericId})`);

                // 패널 내 모든 필터 초기화 요청
                panelWindow.webContents.send('reset-all-filters');
            }, 400);
        }

        // 4. 위젯 창이 있으면 닫기
        const widgetWin = activeWidgetWindows.get(numericId);
        if (widgetWin && !widgetWin.isDestroyed()) {
            console.log(`위젯 창 찾음, 닫기 시작 (ID: ${numericId})`);
            widgetWin.close(); // closed 이벤트에서 activeWidgetWindows.delete 처리
        } else {
            console.error(`위젯 창을 찾을 수 없음 (ID: ${numericId})`);
            // 위젯 창을 찾지 못했어도 맵에서 제거
            activeWidgetWindows.delete(numericId);
        }
    } catch (error) {
        console.error(`위젯 처리 중 오류 발생 (ID: ${numericId}):`, error);
    }
});

// 외부 링크 열기 요청 처리
ipcMain.on('open-external-link', (event, url) => {
  shell.openExternal(url);
});

// OAuth 로그인을 위한 외부 URL 열기 요청
ipcMain.on('open-external-url', (event, url) => {
  shell.openExternal(url);
});

// 메인 앱 화면으로 이동 요청
ipcMain.on('navigate-to-app', (event) => {
  console.log('메인 프로세스: IPC navigate-to-app 요청 받음');

  // 로그인 창이 있다면 닫기
  if (loginWindow && !loginWindow.isDestroyed()) {
    console.log('메인 프로세스: 로그인 창 닫기');
    loginWindow.close();
    loginWindow = null; // 명시적으로 null 설정
  }

  // 아직 패널 윈도우가 없다면 생성
  if (!panelWindow || panelWindow.isDestroyed()) {
    console.log('메인 프로세스: 패널 윈도우 생성');
    createPanelWindow();

    // 패널 윈도우가 생성되면 표시
    if (panelWindow) {
      setTimeout(() => {
        console.log('메인 프로세스: 패널 윈도우 표시');
        positionAndShowPanel();
      }, 200); // 패널 창이 준비될 시간을 주기 위한 약간의 지연
    }
  } else if (panelWindow && !panelWindow.isVisible()) {
    // 이미 패널 윈도우가 있지만 숨겨져 있다면 표시
    console.log('메인 프로세스: 기존 패널 윈도우 표시');
    positionAndShowPanel();
  }

  // 위젯 복원
  console.log('메인 프로세스: 위젯 복원 시도');
  restoreWidgets();
});

// 로그인 창 열기 요청 - 특별 주의: 로그인 버튼 클릭 시 호출됨
ipcMain.on('open-login-window', (event) => {
  console.log('[메인 프로세스] open-login-window 이벤트 수신됨 - 로그인 창 열기 요청');

  // 로그인 HTML 파일 확인
  const loginHtmlPath = path.join(__dirname, 'login.html');
  if (fs.existsSync(loginHtmlPath)) {
    console.log(`[메인 프로세스] login.html 파일 확인됨: ${loginHtmlPath}`);
  } else {
    console.error(`[메인 프로세스] login.html 파일을 찾을 수 없음: ${loginHtmlPath}`);
    // 에러 발생 시 대화상자 표시
    dialog.showErrorBox('오류', 'login.html 파일을 찾을 수 없습니다.');
    return;
  }

  // 직접 createLoginWindow 호출
  try {
    createLoginWindow();
  } catch (error) {
    console.error('[메인 프로세스] 로그인 창 생성 중 예외 발생:', error);
    dialog.showErrorBox('로그인 창 오류', `로그인 창을 열 수 없습니다: ${error.message}`);
  }
});

// 앱 업데이트 직접 호출
ipcMain.on('check-for-updates', () => {
  autoUpdater.checkForUpdates();
});

// 업데이트 설치 및 앱 재시작
ipcMain.on('quit-and-install-update', () => {
  autoUpdater.quitAndInstall();
});

// 앱 버전 정보 제공
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

// 업데이트 다운로드 요청
ipcMain.on('download-update', () => {
  autoUpdater.downloadUpdate();
});

// 설정/정보 창 열기 요청 처리
ipcMain.on('open-settings-window', () => {
  openSettingsWindow();
});

ipcMain.on('open-about-window', () => {
  openAboutWindow();
});

// 패널 위치 조정 및 표시
function positionAndShowPanel() {
  if (!panelWindow) return;

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth } = primaryDisplay.workAreaSize;

  // 목표 위치: 화면 오른쪽 가장자리
  const targetX = screenWidth - PANEL_WIDTH;
  panelWindow.setBounds({
    x: targetX,
    y: 0
  });
  panelWindow.show();
  panelWindow.focus(); // 보여준 후 포커스

  // 렌더러에 애니메이션 시작 메시지 전송
  panelWindow.webContents.send('panel-slide-in');
}

// 패널 숨기기
function hidePanel() {
  if (panelWindow && panelWindow.isVisible()) {
    // 렌더러에 애니메이션 시작 메시지 전송 후 숨김
    panelWindow.webContents.send('panel-slide-out');

    // 애니메이션 시간을 고려하여 약간의 딜레이 후 숨김
    setTimeout(() => {
      if (panelWindow && !panelWindow.isDestroyed()) {
        const primaryDisplay = screen.getPrimaryDisplay();
        const { width: screenWidth } = primaryDisplay.workAreaSize;
        panelWindow.setBounds({ x: screenWidth }); // 화면 밖으로 이동
        panelWindow.hide();
      }
    }, 300); // CSS 애니메이션 시간과 맞춤
  }
}

// 패널 표시/숨김 토글
function togglePanelVisibility() {
  if (!panelWindow) {
    createPanelWindow(); // 창이 없으면 생성
    // 생성 후 바로 위치 잡고 보여주기 위해 약간의 딜레이
    setTimeout(() => {
      if (panelWindow && !panelWindow.isVisible()) {
        positionAndShowPanel();
      }
    }, 100); // 창 생성 시간 고려
    return;
  }

  if (panelWindow.isVisible()) {
    hidePanel();
  } else {
    positionAndShowPanel();
  }
}

// 로그인 창 생성
function createLoginWindow() {
    if (loginWindow) {
        loginWindow.focus();
        return;
    }

    loginWindow = new BrowserWindow({
        width: 480,
        height: 600,
        resizable: false,
        title: 'MemoWave 로그인',
        webPreferences: {
            preload: path.join(__dirname, 'preload-login.js'),
            contextIsolation: true,
            nodeIntegration: false
        },
        icon: tryIconPath // 변경된 아이콘 적용
    });

    loginWindow.loadFile(path.join(__dirname, 'login.html'));

    console.log('[메인 프로세스] 로그인 창 로드 성공');

    // 개발 모드에서 개발자 도구 표시
    loginWindow.webContents.openDevTools({ mode: 'detach' });

    loginWindow.on('closed', () => {
      console.log('[메인 프로세스] 로그인 창 닫힘');
      loginWindow = null;
    });

    // 성공 시 창 포커스
    loginWindow.once('ready-to-show', () => {
      console.log('[메인 프로세스] 로그인 창 표시 준비 완료');
      loginWindow.show();
      loginWindow.focus();
    });

    console.log('[메인 프로세스] 로그인 창 생성 완료');
}

// 로그인 상태 확인
async function checkLoginStatus() {
  const auth = store.get('auth', { isLoggedIn: false, user: null, skipLogin: false, refreshToken: null });
  console.log('메인 프로세스: 로그인 상태 확인 중');

  // 로그인 건너뛰기 상태 확인
  if (auth.skipLogin) {
    console.log('메인 프로세스: 로그인 건너뛰기 상태 확인됨');
    return true;
  }

  // 이미 로그인되어 있는지 확인
  if (auth.isLoggedIn && auth.user) {
    console.log('메인 프로세스: 저장된 로그인 정보 발견, 세션 갱신 시도');

    try {
      // 세션 갱신 시도
      const result = await db.getCurrentUser();

      // 사용자 정보 및 세션이 유효한 경우
      if (result.success && result.user) {
        console.log('메인 프로세스: 세션 갱신 성공, 사용자:', result.user.email);

        // 세션 정보 업데이트 (필요한 경우)
        if (result.session && result.session.refresh_token) {
          console.log('메인 프로세스: 갱신된 세션 정보로 저장소 업데이트');
          store.set('auth', {
            user: result.user,
            isLoggedIn: true,
            skipLogin: false,
            refreshToken: result.session.refresh_token
          });
        }

        return true;
      } else {
        console.log('메인 프로세스: 세션 만료됨, 재인증 필요');

        // 저장된 리프레시 토큰이 있는지 확인
        if (auth.refreshToken) {
          console.log('메인 프로세스: 리프레시 토큰으로 세션 복구 시도');

          try {
            // 리프레시 토큰으로 세션 복구 시도
            const { data, error } = await db.supabase.auth.refreshSession({
              refresh_token: auth.refreshToken
            });

            if (data && data.user && data.session && !error) {
              console.log('메인 프로세스: 리프레시 토큰으로 세션 복구 성공');

              // 새 세션 정보 저장
              store.set('auth', {
                user: data.user,
                isLoggedIn: true,
                skipLogin: false,
                refreshToken: data.session.refresh_token
              });

              return true;
            } else {
              console.error('메인 프로세스: 리프레시 토큰으로 세션 복구 실패:', error?.message);
            }
          } catch (refreshError) {
            console.error('메인 프로세스: 리프레시 토큰 처리 중 오류:', refreshError);
          }
        }

        // 모든 복구 시도가 실패하면 로그인 정보 초기화
        console.log('메인 프로세스: 로그인 정보 초기화');
        store.set('auth', { isLoggedIn: false, user: null, skipLogin: false, refreshToken: null });
        return false;
      }
    } catch (error) {
      console.error('메인 프로세스: 세션 확인 중 오류 발생:', error);
      console.log('메인 프로세스: 로그인 정보 초기화');
      store.set('auth', { isLoggedIn: false, user: null, skipLogin: false, refreshToken: null });
      return false;
    }
  }

  console.log('메인 프로세스: 로그인 상태 아님');
  return false;
}

// 딥 링크 처리 함수
function handleDeepLink(url) {
  console.log('메인 프로세스: URL 처리:', url);
  const urlObj = new URL(url);

  // 로그인 콜백 처리
  if (urlObj.hostname === 'login-callback') {
    handleOAuthCallback(url);
  }
}

// === OAuth 콜백 처리 함수 ===
async function handleOAuthCallback(callbackUrl) { // async 키워드 추가
  console.log("---------------- OAuth 콜백 처리 시작 ----------------");
  console.log("메인 프로세스: OAuth 콜백 URL 수신 (길이):", callbackUrl.length);
  console.log("메인 프로세스: handleOAuthCallback 실행 시작, callbackUrl 첫 부분:",
    callbackUrl ? callbackUrl.substring(0, 30) + "..." : "undefined");

  try {
    // 1. URL이 유효한지 확인
    if (!callbackUrl) {
      console.error("메인 프로세스: 콜백 URL이 비어있음");
      throw new Error("콜백 URL이 비어있습니다.");
    }

    console.log("메인 프로세스: 콜백 URL 유효성 확인 완료");
    console.log("메인 프로세스: URL에 토큰 포함 여부 - access_token:", callbackUrl.includes("access_token"),
      ", refresh_token:", callbackUrl.includes("refresh_token"));

    // 2. 직접 토큰 추출 시도 (URL 파싱 실패 대비)
    let accessToken = null;
    let refreshToken = null;

    // access_token 추출
    const accessTokenMatch = callbackUrl.match(/access_token=([^&]+)/);
    if (accessTokenMatch?.length > 1) {
      accessToken = accessTokenMatch[1];
      console.log("메인 프로세스: 정규식으로 추출한 액세스 토큰 길이:", accessToken.length);
      console.log("메인 프로세스: 액세스 토큰 첫 부분:", accessToken.substring(0, 10) + "...");
    } else {
      console.error("메인 프로세스: 액세스 토큰 추출 실패");
    }

    // refresh_token 추출
    const refreshTokenMatch = callbackUrl.match(/refresh_token=([^&]+)/);
    if (refreshTokenMatch?.length > 1) {
      refreshToken = refreshTokenMatch[1];
      console.log("메인 프로세스: 정규식으로 추출한 리프레시 토큰 길이:", refreshToken.length);
      console.log("메인 프로세스: 리프레시 토큰 첫 부분:", refreshToken.substring(0, 10) + "...");
    } else {
      console.log("메인 프로세스: 리프레시 토큰 추출 실패 또는 없음");
    }

    // 3. URL 객체로 파싱 시도 (더 정확한 파싱을 위해)
    console.log("메인 프로세스: URL 객체로 파싱 시도");
    try {
      const urlObj = new URL(callbackUrl);
      console.log("메인 프로세스: URL 파싱 성공");
      console.log("메인 프로세스: 프로토콜:", urlObj.protocol);
      console.log("메인 프로세스: 호스트네임:", urlObj.hostname);
      console.log("메인 프로세스: 해시 존재 여부:", !!urlObj.hash);

      // URL 해시에서 파라미터 추출
      if (urlObj.hash) {
        console.log("메인 프로세스: 해시 존재: 길이", urlObj.hash.length);
        console.log("메인 프로세스: 해시 첫 부분:", urlObj.hash.substring(0, 20) + "...");
        const fragment = urlObj.hash.substring(1); // '#' 기호 제거
        const params = new URLSearchParams(fragment);

        // URL 객체를 통해 토큰 재추출 (더 신뢰할 수 있음)
        const accessTokenFromUrl = params.get('access_token');
        const refreshTokenFromUrl = params.get('refresh_token');

        // 더 신뢰할 수 있는 URL 객체에서 추출한 값으로 대체
        if (accessTokenFromUrl) {
          accessToken = accessTokenFromUrl;
          console.log("메인 프로세스: URL 객체에서 추출한 액세스 토큰 길이:", accessToken.length);
          console.log("메인 프로세스: URL 객체에서 추출한 액세스 토큰 첫 부분:", accessToken.substring(0, 10) + "...");
        } else {
          console.error("메인 프로세스: URL 객체에서 액세스 토큰을 추출할 수 없음");
        }

        if (refreshTokenFromUrl) {
          refreshToken = refreshTokenFromUrl;
          console.log("메인 프로세스: URL 객체에서 추출한 리프레시 토큰 길이:", refreshToken.length);
          console.log("메인 프로세스: URL 객체에서 추출한 리프레시 토큰 첫 부분:", refreshToken.substring(0, 10) + "...");
        } else {
          console.log("메인 프로세스: URL 객체에서 리프레시 토큰을 추출할 수 없음");
        }
      } else {
        console.error("메인 프로세스: URL에 해시 부분이 없음");
      }
    } catch (urlError) {
      console.error("메인 프로세스: URL 파싱 오류:", urlError);
    }

    // 4. 최종 토큰 확인
    console.log("메인 프로세스: 최종 액세스 토큰 존재:", !!accessToken);
    console.log("메인 프로세스: 최종 리프레시 토큰 존재:", !!refreshToken);

            // 5. 액세스 토큰 유효성 검증
        if (!accessToken) {
          console.error("메인 프로세스: 액세스 토큰이 없습니다.");
          if (loginWindow && !loginWindow.isDestroyed()) {
            loginWindow.webContents.send('login-error', '로그인 처리 중 오류: 인증 토큰을 가져올 수 없습니다.');
          }
          throw new Error("액세스 토큰이 없습니다.");
        }

        if (accessToken && db.supabase) {
          console.log("메인 프로세스: Supabase 세션 설정 시도...");
          console.log("메인 프로세스: db.supabase 객체 존재:", !!db.supabase);
          console.log("메인 프로세스: db.supabase.auth 객체 존재:", !!db.supabase.auth);

      try {
        // Supabase 세션 설정을 기다림
        console.log("메인 프로세스: supabase.auth.setSession 호출 직전");
        const { data, error } = await db.supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken || '' // 리프레시 토큰이 없으면 빈 문자열
        });
        console.log("메인 프로세스: supabase.auth.setSession 호출 완료");

        if (error) {
          console.error("메인 프로세스: Supabase 세션 설정 실패:", error);
          console.error("메인 프로세스: 오류 메시지:", error.message);
          console.error("메인 프로세스: 오류 상태 코드:", error.status);

          // 에러 발생 시 로그인 창에 에러 메시지 전송
          if (loginWindow && !loginWindow.isDestroyed()) {
            loginWindow.webContents.send('login-error', `세션 설정 실패: ${error.message}`);
          }
        } else {
          console.log("메인 프로세스: Supabase 세션 설정 성공:", !!data);
          console.log("메인 프로세스: 사용자 데이터 존재:", !!data?.user);
          console.log("메인 프로세스: 세션 데이터 존재:", !!data?.session);

          if (data?.user) {
            console.log("메인 프로세스: 사용자 정보 - 이메일:", data.user.email);
            console.log("메인 프로세스: 사용자 정보 - ID:", data.user.id);
          }

          // 로그인 상태 저장
          console.log("메인 프로세스: 로그인 상태 저장 시작");
          store.set('auth', {
            user: data?.user || null,
            isLoggedIn: true,
            skipLogin: false,
            refreshToken: data?.session?.refresh_token || refreshToken || null
          });
          console.log("메인 프로세스: 로그인 상태 저장 완료");

          // 세션 설정 성공 후 로그인 창 관련 처리
          console.log("메인 프로세스: 세션 설정 후 UI 처리 시작");

          if (loginWindow && !loginWindow.isDestroyed()) {
            console.log("메인 프로세스: OAuth 콜백 성공 후 로그인 창 닫기 및 메인 앱으로 이동");

            try {
              // 성공 이벤트 전송 (UI 업데이트용 - 선택적)
              console.log("메인 프로세스: 로그인 성공 이벤트 전송 시도");
              loginWindow.webContents.send('google-login-success', {
                success: true,
                user: data?.user || null,
                session: data?.session || null
              });
              console.log("메인 프로세스: 로그인 성공 이벤트 전송 완료");

              // 짧은 딜레이 후 로그인 창 닫기 (UI 메시지가 표시될 시간을 주기 위함)
              setTimeout(() => {
                console.log("메인 프로세스: 로그인 창 닫기 타이머 실행");
                if (loginWindow && !loginWindow.isDestroyed()) {
                  console.log("메인 프로세스: 로그인 창 닫기 시작");
                  loginWindow.close();
                  loginWindow = null; // 참조 제거
                  console.log("메인 프로세스: 로그인 창 닫기 완료");

                  // 패널 윈도우 생성 또는 표시
                  if (!panelWindow || panelWindow.isDestroyed()) {
                    console.log('메인 프로세스: 패널 윈도우 생성');
                    createPanelWindow();

                    setTimeout(() => {
                      if (panelWindow && !panelWindow.isDestroyed()) {
                        console.log('메인 프로세스: 패널 윈도우 표시');
                        positionAndShowPanel();
                      }
                    }, 200);
                  } else if (panelWindow && !panelWindow.isVisible()) {
                    console.log('메인 프로세스: 기존 패널 윈도우 표시');
                    positionAndShowPanel();
                  }

                  // 위젯 복원
                  console.log('메인 프로세스: 위젯 복원 시도');
                  restoreWidgets();
                } else {
                  console.log("메인 프로세스: 로그인 창이 이미 닫혔거나 파괴됨");
                }
              }, 500);
            } catch (uiError) {
              console.error("메인 프로세스: UI 업데이트 중 오류:", uiError);
            }
          } else {
            console.warn("메인 프로세스: 콜백을 처리할 유효한 창이 없습니다.");

            // 창이 없으면 새로 로그인 창을 열거나 패널을 표시
            if (panelWindow && !panelWindow.isDestroyed()) {
              // 패널 창이 있는 경우, 표시
              if (!panelWindow.isVisible()) {
                positionAndShowPanel();
              }
            } else {
              // 패널 창이 없는 경우, 새로 생성
              createPanelWindow();
              setTimeout(() => positionAndShowPanel(), 200);
            }

            // 위젯 복원
            restoreWidgets();
          }
        }
      } catch (sessionError) {
        console.error("메인 프로세스: Supabase 세션 설정 중 예외 발생:", sessionError);
        if (loginWindow && !loginWindow.isDestroyed()) {
          loginWindow.webContents.send('login-error', `세션 설정 중 오류 발생: ${sessionError.message}`);
        }
      }
    } else {
      console.error("액세스 토큰이 없거나 Supabase 객체가 없습니다.");
      if (loginWindow && !loginWindow.isDestroyed()) {
        loginWindow.webContents.send('login-error', '유효한 로그인 토큰을 받지 못했습니다.');
      }
    }
  } catch (parseError) {
    console.error("URL 파싱 오류:", parseError);
    if (loginWindow && !loginWindow.isDestroyed()) {
      loginWindow.webContents.send('login-error', `URL 형식 오류: ${parseError.message}`);
    }
  }

  console.log("---------------- OAuth 콜백 처리 완료 ----------------");
}

// 로그인 관련 IPC 핸들러 설정
function setupAuthIpcHandlers() {
  // 구글 로그인 요청
  safelyRegisterHandler('sign-in-with-google', async () => {
    try {
      console.log('메인 프로세스: IPC sign-in-with-google 요청 받음');
      const result = await db.signInWithGoogle();
      console.log('메인 프로세스: signInWithGoogle 결과:', result);

      if (result.success && result.url) {
        // 브라우저에서 구글 로그인 URL 열기
        console.log('메인 프로세스: 외부 브라우저에서 Google 로그인 URL 열기:', result.url);
        shell.openExternal(result.url);
        return { success: true, message: "Google 로그인 창을 열었습니다. 로그인을 완료해주세요." };
      }

      return { success: false, error: result.error || '로그인 URL을 받지 못했습니다.' };
    } catch (error) {
      console.error('메인 프로세스: 구글 로그인 요청 오류:', error);
      return { success: false, error: error.message || '구글 로그인 시작 중 오류 발생' };
    }
  });

  // 수동으로 액세스 토큰 URL 처리하기 (브라우저에서 받은 URL을 수동으로 처리)
  safelyRegisterHandler('process-oauth-callback', async (event, url) => {
    console.log('메인 프로세스: 수동 OAuth 콜백 처리 요청 받음, URL 길이:', url.length);
    console.log('메인 프로세스: 수동 입력된 URL 시작 부분:', url.substring(0, 50) + '...');
    console.log('메인 프로세스: access_token 포함 여부:', url.includes('access_token'));
    console.log('메인 프로세스: refresh_token 포함 여부:', url.includes('refresh_token'));

    try {
      // URL이 localhost로 시작하면 memowave:// 프로토콜로 변환
      let callbackUrl = url;
      if (url.startsWith('http://localhost:3000/') && url.includes('access_token=')) {
        // URL 파라미터 추출
        const hashPart = url.split('#')[1] || '';
        if (!hashPart) {
          console.error('메인 프로세스: URL에 해시 부분이 없거나 접근 토큰이 포함되지 않음');
          return { success: false, error: 'URL에 접근 토큰이 포함되어 있지 않습니다.' };
        }

        callbackUrl = `memowave://login-callback#${hashPart}`;
        console.log('메인 프로세스: URL 프로토콜 변환 성공');
        console.log('메인 프로세스: 변환된 URL 시작 부분:', callbackUrl.substring(0, 50) + '...');
        console.log('메인 프로세스: 변환된 URL 길이:', callbackUrl.length);
      }

      // 토큰 추출 테스트
      if (url.includes('access_token=')) {
        const match = url.match(/access_token=([^&]+)/);
        if (match && match[1]) {
          console.log('메인 프로세스: 액세스 토큰 추출 성공, 토큰 길이:', match[1].length);
          console.log('메인 프로세스: 토큰 처음 10자:', match[1].substring(0, 10) + '...');
        } else {
          console.warn('메인 프로세스: URL에서 액세스 토큰을 추출할 수 없습니다.');
        }
      }

      console.log('메인 프로세스: handleOAuthCallback 함수 호출 직전');
      // OAuth 콜백 처리 함수 직접 호출
      await handleOAuthCallback(callbackUrl);
      console.log('메인 프로세스: handleOAuthCallback 함수 실행 완료');

      return { success: true, message: 'URL이 성공적으로 처리되었습니다.' };
    } catch (error) {
      console.error('메인 프로세스: 수동 OAuth 콜백 처리 오류:', error);
      return { success: false, error: `URL 처리 오류: ${error.message}` };
    }
  });

  // 현재 로그인 상태 가져오기
  safelyRegisterHandler('get-auth-state', async () => {
    return store.get('auth');
  });

  // 로그아웃
  safelyRegisterHandler('sign-out', async () => {
    try {
      const result = await db.signOut();
      if (result.success) {
        // 로그인 정보 초기화
        store.set('auth', {
          user: null,
          isLoggedIn: false,
          skipLogin: false
        });

        // 창 닫기
        if (panelWindow && !panelWindow.isDestroyed()) {
          panelWindow.close();
        }

        // 위젯 닫기
        const widgetWindowsToClose = Array.from(activeWidgetWindows.values());
        for (const widgetWindow of widgetWindowsToClose) {
          if (widgetWindow && !widgetWindow.isDestroyed()) {
            widgetWindow.close();
          }
        }

        // 로그인 창 표시
        createLoginWindow();

        return { success: true };
      }

      return { success: false, error: result.error };
    } catch (error) {
      console.error('로그아웃 오류:', error);
      return { success: false, error: error.message };
    }
  });

  // on 이벤트는 removeHandler로 처리할 수 없으므로 개별 처리
  // 로그인 건너뛰기
  try {
    // 등록 전 기존 이벤트 리스너 제거 시도
    ipcMain.removeAllListeners('skip-login');
    console.log('[메인 프로세스] skip-login 이벤트 리스너 재설정 완료');

    ipcMain.on('skip-login', () => {
      console.log('메인 프로세스: IPC skip-login 요청 받음');
      store.set('auth', {
        user: null,
        isLoggedIn: false,
        skipLogin: true
      });

      // 로그인 창 닫기
      if (loginWindow && !loginWindow.isDestroyed()) {
        loginWindow.close();
      }

      // 패널 윈도우 생성
      createPanelWindow();

      // 위젯 복원
      restoreWidgets();
    });
  } catch (error) {
    console.error('[메인 프로세스] skip-login 이벤트 리스너 설정 오류:', error);
  }
}

// OAuth 콜백을 처리하는 로컬 HTTP 서버 시작 함수
function startLocalCallbackServer() {
  return new Promise((resolve, reject) => {
    // HTTP 서버 생성
    const server = http.createServer(async (req, res) => {
      try {
        const parsedUrl = url.parse(req.url, true);
        console.log('[메인 프로세스] 로컬 콜백 서버 요청 수신:', parsedUrl.pathname);

        // 루트 경로 또는 빈 경로 처리 (토큰이 해시에 포함된 경우)
        if (parsedUrl.pathname === '/' || parsedUrl.pathname === '') {
          // 기본 응답 페이지 제공
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(`
            <html>
              <head>
                <title>MemoWave 인증</title>
                <style>
                  body {
                    font-family: Arial, sans-serif;
                    text-align: center;
                    padding-top: 50px;
                    background-color: #f5f5f5;
                  }
                  .container {
                    background-color: white;
                    border-radius: 8px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                    padding: 20px;
                    max-width: 500px;
                    margin: 0 auto;
                  }
                  h2 {
                    color: #4a6da7;
                  }
                  .spinner {
                    margin: 20px auto;
                    border: 4px solid rgba(0,0,0,0.1);
                    width: 36px;
                    height: 36px;
                    border-radius: 50%;
                    border-left-color: #4a6da7;
                    animation: spin 1s linear infinite;
                  }
                  @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                  }
                </style>
              </head>
              <body>
                <div class="container">
                  <h2>MemoWave 로그인</h2>
                  <p id="status">인증 정보를 처리 중입니다...</p>
                  <div class="spinner"></div>
                </div>
                <script>
                  // 해시가 있으면 처리
                  const hash = window.location.hash.substring(1);
                  if (hash && hash.includes('access_token')) {
                    // 해시 파라미터 파싱
                    const hashParams = new URLSearchParams(hash);
                    const accessToken = hashParams.get('access_token');
                    const refreshToken = hashParams.get('refresh_token');

                    if (accessToken && refreshToken) {
                      // 토큰 정보를 memowave:// 프로토콜로 생성하여 메인 프로세스에 전달
                      const callbackUrl = 'memowave://login-callback#' + hash;
                      window.location.href = callbackUrl;

                      // 3초 후 창 닫기
                      setTimeout(() => {
                        document.getElementById('status').textContent = '로그인 성공! 앱으로 돌아갑니다.';
                        setTimeout(() => window.close(), 1000);
                      }, 2000);
                    }
                  }
                </script>
              </body>
            </html>
          `);
        }
        // 콜백 경로 처리 (/callback)
        else if (parsedUrl.pathname === '/callback') {
          // 콜백 응답 페이지 제공
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(`
            <html>
              <head>
                <title>MemoWave 인증</title>
                <style>
                  body {
                    font-family: Arial, sans-serif;
                    text-align: center;
                    padding-top: 50px;
                    background-color: #f5f5f5;
                  }
                  .container {
                    background-color: white;
                    border-radius: 8px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                    padding: 20px;
                    max-width: 500px;
                    margin: 0 auto;
                  }
                  h2 {
                    color: #4a6da7;
                  }
                  .spinner {
                    margin: 20px auto;
                    border: 4px solid rgba(0,0,0,0.1);
                    width: 36px;
                    height: 36px;
                    border-radius: 50%;
                    border-left-color: #4a6da7;
                    animation: spin 1s linear infinite;
                  }
                  @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                  }
                </style>
              </head>
              <body>
                <div class="container">
                  <h2>MemoWave 로그인</h2>
                  <p id="status">인증 정보를 처리 중입니다...</p>
                  <div class="spinner"></div>
                </div>
                <script>
                  // URL 파라미터에서 코드 추출
                  const urlParams = new URLSearchParams(window.location.search);
                  const code = urlParams.get('code');

                  if (code) {
                    // 인증 코드를 직접 메인 프로세스로 전달
                    fetch('/handle-auth-code', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ code })
                    })
                    .then(response => response.json())
                    .then(data => {
                      if (data.success) {
                        document.getElementById('status').textContent = '로그인 성공! 앱으로 돌아갑니다.';
                        setTimeout(() => window.close(), 2000);
                      } else {
                        document.getElementById('status').textContent = '인증 처리 중 오류가 발생했습니다: ' + data.error;
                      }
                    })
                    .catch(error => {
                      document.getElementById('status').textContent = '인증 요청 중 오류가 발생했습니다.';
                      console.error('인증 요청 오류:', error);
                    });
                  } else {
                    // 해시가 있는지 확인 (SPA 방식의 OAuth)
                    const hash = window.location.hash.substring(1);
                    if (hash && hash.includes('access_token')) {
                      // 해시 파라미터 파싱
                      const hashParams = new URLSearchParams(hash);
                      const accessToken = hashParams.get('access_token');
                      const refreshToken = hashParams.get('refresh_token');

                      if (accessToken && refreshToken) {
                        // 토큰 정보를 memowave:// 프로토콜로 생성하여 메인 프로세스에 전달
                        const callbackUrl = 'memowave://login-callback#' + hash;
                        window.location.href = callbackUrl;

                        // 3초 후 창 닫기
                        setTimeout(() => {
                          document.getElementById('status').textContent = '로그인 성공! 앱으로 돌아갑니다.';
                          setTimeout(() => window.close(), 1000);
                        }, 2000);
                      }
                    } else {
                      document.getElementById('status').textContent = '인증 정보를 찾을 수 없습니다.';
                    }
                  }
                </script>
              </body>
            </html>
          `);
        }
        // 인증 코드 처리 엔드포인트
        else if (parsedUrl.pathname === '/handle-auth-code') {
          if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => {
              body += chunk.toString();
            });

            req.on('end', async () => {
              try {
                const { code } = JSON.parse(body);
                console.log('[메인 프로세스] 인증 코드 수신:', code);

                if (!code) {
                  res.writeHead(400, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({ success: false, error: '유효한 인증 코드가 없습니다' }));
                  return;
                }

                // 인증 코드 처리
                if (db && db.supabase) {
                  try {
                    // Supabase에서 인증 코드로 세션 교환
                    const { data, error } = await db.supabase.auth.exchangeCodeForSession(code);

                    if (error) {
                      console.error('[메인 프로세스] 인증 코드 교환 오류:', error);
                      res.writeHead(500, { 'Content-Type': 'application/json' });
                      res.end(JSON.stringify({ success: false, error: error.message }));
                      return;
                    }

                    console.log('[메인 프로세스] 인증 코드 교환 성공');

                    // 세션 데이터 처리
                    if (data && data.session) {
                      // 사용자 세션 설정
                      store.set('auth', {
                        user: data.user,
                        isLoggedIn: true,
                        skipLogin: false,
                        refreshToken: data.session.refresh_token || null
                      });

                      // UI 업데이트
                      updateUIAfterLogin(data);

                      res.writeHead(200, { 'Content-Type': 'application/json' });
                      res.end(JSON.stringify({ success: true }));
                    } else {
                      res.writeHead(500, { 'Content-Type': 'application/json' });
                      res.end(JSON.stringify({ success: false, error: '세션 데이터가 없습니다' }));
                    }
                  } catch (error) {
                    console.error('[메인 프로세스] 세션 교환 오류:', error);
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: error.message }));
                  }
                } else {
                  res.writeHead(500, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({ success: false, error: 'Supabase 인스턴스를 찾을 수 없습니다' }));
                }
              } catch (error) {
                console.error('[메인 프로세스] 요청 처리 오류:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: '서버 내부 오류' }));
              }
            });
          } else {
            res.writeHead(405, { 'Content-Type': 'text/plain' });
            res.end('Method Not Allowed');
          }
        } else {
          // 다른 경로는 404 처리
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Not Found');
        }
      } catch (error) {
        console.error('[메인 프로세스] 서버 요청 처리 오류:', error);
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Internal Server Error');
      }
    });

    // 서버 시작
    server.listen(LOCAL_CALLBACK_PORT, 'localhost', () => {
      console.log(`[메인 프로세스] 로컬 OAuth 콜백 서버 시작됨: http://localhost:${LOCAL_CALLBACK_PORT}`);
      resolve(server);
    });

    // 오류 처리
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`[메인 프로세스] 포트 ${LOCAL_CALLBACK_PORT}가 이미 사용 중입니다. 다른 포트를 사용하거나 해당 포트를 사용하는 프로세스를 종료하세요.`);
      } else {
        console.error('[메인 프로세스] 로컬 콜백 서버 오류:', err);
      }
      reject(err);
    });
  });
}

// URL에서 인증 정보 추출 (해시 또는 코드)
function extractAuthInfoFromURL(requestUrl, parsedUrl) {
  if (!requestUrl) return null;

  // 파싱된 URL에서 쿼리 파라미터 확인
  const code = parsedUrl.query.code;

  // URL 해시는 서버에서 직접 접근할 수 없지만, 클라이언트에서 전달받을 것임
  // 이 함수는 requestUrl에서 해시를 직접 추출하지 않고, 다른 경로로 받을 것임을 가정

  if (code) {
    return { code };
  }

  return null;
}

// OAuth 해시로부터 인증 처리
function processOAuthHash(hash) {
  console.log('[메인 프로세스] OAuth 해시 처리 시작');

  try {
    // 해시를 memowave:// URL로 변환하여 기존 OAuth 콜백 처리 재사용
    const callbackUrl = `memowave://login-callback#${hash}`;
    console.log('[메인 프로세스] 콜백 URL 생성:', callbackUrl.substring(0, 30) + '...');

    // 기존 OAuth 콜백 처리 함수 호출
    handleOAuthCallback(callbackUrl);
  } catch (error) {
    console.error('[메인 프로세스] OAuth 해시 처리 오류:', error);
  }
}

// OAuth 인증 코드 처리
async function processOAuthCode(code) {
  console.log('[메인 프로세스] OAuth 인증 코드 처리 시작');

  try {
    if (!db || !db.supabase) {
      throw new Error('Supabase 인스턴스를 찾을 수 없습니다');
    }

    // Supabase에서 인증 코드로 세션 교환
    console.log('[메인 프로세스] 인증 코드로 세션 교환 시도');
    const { data, error } = await db.supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error('[메인 프로세스] 인증 코드 교환 오류:', error);
      return;
    }

    console.log('[메인 프로세스] 인증 코드 교환 성공');

    // 세션 데이터 처리
    if (data && data.session) {
      // 사용자 세션 설정
      console.log('[메인 프로세스] 사용자 세션 설정');
      store.set('auth', {
        user: data.user,
        isLoggedIn: true,
        skipLogin: false,
        refreshToken: data.session.refresh_token || null
      });

      // 앱 UI 업데이트 및 로그인 창 관리
      updateUIAfterLogin(data);
    }
  } catch (error) {
    console.error('[메인 프로세스] 인증 코드 처리 오류:', error);
  }
}

// 로그인 후 UI 업데이트
function updateUIAfterLogin(data) {
  console.log('[메인 프로세스] 로그인 후 UI 업데이트');

  // 로그인 창이 있다면 닫기
  if (loginWindow && !loginWindow.isDestroyed()) {
    console.log('[메인 프로세스] 로그인 창 닫기');
    loginWindow.close();
    loginWindow = null;
  }

  // 패널 창 생성 또는 표시
  if (!panelWindow || panelWindow.isDestroyed()) {
    console.log('[메인 프로세스] 패널 창 생성');
    createPanelWindow();
    setTimeout(() => {
      if (panelWindow && !panelWindow.isDestroyed()) {
        positionAndShowPanel();
      }
    }, 200);
  } else if (panelWindow && !panelWindow.isVisible()) {
    console.log('[메인 프로세스] 기존 패널 창 표시');
    positionAndShowPanel();
  }

  // 위젯 복원
  console.log('[메인 프로세스] 위젯 복원');
  restoreWidgets();
}

// Windows에서 URL 스키마 등록 강화하는 함수
function enhanceProtocolRegistration() {
  if (process.platform !== 'win32') return;

  try {
    // Electron 기본 프로토콜 등록 방식 사용
    // 개발 모드에서 프로토콜 등록
    if (process.defaultApp) {
      if (process.argv.length >= 2) {
        app.setAsDefaultProtocolClient('memowave', process.execPath, [path.resolve(process.argv[1])]);
        console.log('개발 모드에서 memowave:// 프로토콜 등록 완료');
      }
    } else {
      // 프로덕션 모드에서 프로토콜 등록
      app.setAsDefaultProtocolClient('memowave');
      console.log('프로덕션 모드에서 memowave:// 프로토콜 등록 완료');
    }

    // URL 스키마가 잘 작동하지 않을 경우를 위한 정보 메시지 표시
    console.log('URL 스키마 등록 - 자동으로 앱으로 돌아오지 않을 경우 수동 URL 입력 사용 가능');
  } catch (error) {
    console.error('프로토콜 등록 강화 중 오류 발생:', error);
  }
}

// 아이콘 경로 상수 정의
const appIconPath = path.join(__dirname, 'assets', 'icon.png');
const tryIconPath = path.join(__dirname, 'assets', 'try_icon.png');

// 패널 새로고침 요청 처리
ipcMain.on('refresh-panel', (event) => {
  if (panelWindow && !panelWindow.isDestroyed()) {
    console.log('[메인 프로세스] 패널 새로고침 요청 수신');

    // 모든 필터 초기화 요청
    panelWindow.webContents.send('reset-all-filters');

    // 위젯 상태인 메모 목록을 갱신하도록 요청
    panelWindow.webContents.send('refresh-memos');

    // 마지막으로 복원된 메모가 있다면 해당 메모로 포커스 요청
    if (global.lastRestoredMemoId) {
      console.log(`[메인 프로세스] 마지막으로 복원된 메모(ID: ${global.lastRestoredMemoId})로 포커스 요청`);
      panelWindow.webContents.send('show-panel-and-focus-memo', global.lastRestoredMemoId);

      // 처리 후 변수 초기화
      global.lastRestoredMemoId = null;
    }
  }
});

// 위젯 메모를 강제로 표시 요청
ipcMain.on('force-show-memo', (event, memoId) => {
  if (panelWindow && !panelWindow.isDestroyed()) {
    console.log(`[메인 프로세스] 메모 ID ${memoId} 강제 표시 요청`);
    panelWindow.webContents.send('force-show-memo', memoId);
  }
});
