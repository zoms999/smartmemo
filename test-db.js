const { createClient } = require('@supabase/supabase-js');
const { Pool } = require('pg');
const config = require('./db-config');

// 한글 인코딩 설정
process.env.LANG = 'ko_KR.UTF-8';
process.env.LC_ALL = 'ko_KR.UTF-8';

console.log('======= Supabase 연결 테스트 =======');
console.log('URL:', config.SUPABASE_URL);
console.log('키 (일부):', config.SUPABASE_KEY.substring(0, 10) + '...');

// Supabase 클라이언트 초기화
const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_KEY);

// PostgreSQL 연결 풀 초기화
const pgConnectionString = config.PG_CONNECTION_STRING;
console.log('PostgreSQL 연결 문자열:', pgConnectionString.replace(/:[^:]*@/, ':***@'));

const pool = new Pool({
  connectionString: pgConnectionString,
});

async function testDb() {
  try {
    console.log('\n1. Supabase API 연결 테스트...');
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('  ❌ Supabase API 연결 실패:', sessionError.message);
    } else {
      console.log('  ✅ Supabase API 연결 성공');
    }
    
    console.log('\n2. PostgreSQL 직접 연결 테스트...');
    const client = await pool.connect();
    try {
      const res = await client.query('SELECT NOW()');
      console.log('  ✅ PostgreSQL 연결 성공. 서버 시간:', res.rows[0].now);
    } catch (err) {
      console.error('  ❌ PostgreSQL 연결 실패:', err.message);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('테스트 중 오류 발생:', error);
  } finally {
    pool.end();
  }
}

testDb(); 