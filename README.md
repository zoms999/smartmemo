# MemoWave

스마트한 메모 관리 애플리케이션입니다. Electron 기반으로 개발되었으며, Supabase를 활용한 클라우드 동기화 기능을 지원합니다.

## 주요 기능

- 💡 마크다운 기반 메모 작성 및 관리
- 🔄 Supabase를 통한 클라우드 동기화
- 🌙 다크 모드 지원
- 🔒 Google OAuth 로그인
- 🏷️ 카테고리 및 태그 관리
- 🔔 메모 알림 기능
- 📌 위젯 모드 지원

## 설치 및 실행

### 필수 환경

- Node.js v14 이상
- npm 또는 yarn

### 설치 방법

1. 저장소 클론
   ```bash
   git clone https://github.com/zoms999/smartmemo.git
   cd smartmemo
   ```

2. 의존성 설치
   ```bash
   npm install
   ```

3. 환경 설정
   - `db-config.js` 파일에 Supabase 및 Google OAuth 설정 추가

4. 애플리케이션 실행
   ```bash
   npm start
   ```

## 기술 스택

- **프레임워크**: Electron
- **언어**: JavaScript
- **데이터베이스**: Supabase (PostgreSQL)
- **인증**: Google OAuth
- **기타 라이브러리**:
  - marked (마크다운 렌더링)
  - electron-store (로컬 데이터 저장)

## 개발자 정보

- 개발자: zoms999

## 라이선스

MIT License


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
