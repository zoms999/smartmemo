# MemoWave

스마트한 메모 관리 애플리케이션입니다.

## 구글 로그인 설정 방법

MemoWave는 Supabase를 통한 구글 로그인을 지원합니다. 로그인 기능을 사용하려면 아래 단계에 따라 설정하세요.

### 1. Supabase 프로젝트 설정

1. [Supabase 대시보드](https://app.supabase.io/)에 로그인합니다.
2. 프로젝트 → 인증 → 제공업체로 이동합니다.
3. Google 제공업체를 찾아 활성화하고, 구글 OAuth 사용자 인증 정보를 입력합니다.

### 2. 딥 링크 설정 (URI 리디렉션)

다음 URI를 Supabase 및 Google Cloud Console에 리디렉션 URI로 추가해야 합니다:

```
memowave://login-callback
```

### 3. Google Cloud Console 설정

1. [Google Cloud Console](https://console.cloud.google.com/)에 접속합니다.
2. 사용자 인증 정보 → OAuth 클라이언트 ID에서 리디렉션 URI에 위에서 언급한 URI를 추가합니다.

### 4. 로컬 개발환경 설정

개발 환경에서 테스트하려면 다음 명령어로 앱을 실행하세요:

```bash
npm run dev
```

## 주요 기능

- 메모 작성 및 관리
- 카테고리와 태그 기능
- 마크다운 편집 지원
- 우선순위 및 알림 설정
- 데이터 내보내기/가져오기
- 구글 로그인 및 데이터 동기화
- 다크모드 지원

## 기술 스택

- Electron
- JavaScript
- Supabase (인증 및 데이터베이스)

## 개선 아이디어

- 메모 색상 변경 기능
- 메모 태그 기능
- 메모 검색 기능
- 메모 알림 기능
- 서체 변경 및 서식 지정 기능
- 트레이 아이콘 상태 표시 (읽지 않은 메모 수 등)

## 라이센스

MIT 라이센스 


electron-memo-app/
├── package.json
├── main.js
├── preload.js
├── preload-panel.js   // 패널용 프리로드 스크립트 (필요시)
├── index.html         // (기존 메인 메모 앱 UI, 여기서는 사용 안 함 또는 다른 용도로)
├── renderer.js        // (기존 메인 메모 앱 로직)
├── style.css          // (기존 메인 메모 앱 스타일)
├── panel.html         // 슬라이드 패널 UI
├── panel-renderer.js  // 슬라이드 패널 로직
├── panel-style.css    // 슬라이드 패널 스타일
├── assets/
│   ├── icon.png
│   └── tray-icon.png
└── data/
    └── memos.json