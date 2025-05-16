// db-config.example.js
// Supabase 연결 정보 예시 파일
// 이 파일을 db-config.js로 복사하고 실제 값을 입력하세요.

module.exports = {
  // Supabase URL (Supabase 프로젝트 설정에서 확인)
  SUPABASE_URL: 'YOUR_SUPABASE_URL',

  // Supabase 서비스 롤 키 (Supabase 프로젝트 설정에서 확인)
  SUPABASE_KEY: 'YOUR_SUPABASE_KEY',

  // PostgreSQL 직접 연결 정보
  PG_CONNECTION_STRING: 'postgresql://username:password@host:port/database',
};

// Google OAuth 설정
// 클라이언트 ID: YOUR_GOOGLE_CLIENT_ID
// 클라이언트 보안 비밀번호: YOUR_GOOGLE_CLIENT_SECRET
