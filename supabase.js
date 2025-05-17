const { createClient } = require('@supabase/supabase-js');
const { Pool } = require('pg');
const config = require('./db-config');
const path = require('path');
const fs = require('fs');

// 한글 인코딩 설정 추가
process.env.LANG = 'ko_KR.UTF-8';
process.env.LC_ALL = 'ko_KR.UTF-8';

// Supabase 클라이언트 초기화
const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_KEY);

// PostgreSQL 연결 풀 초기화 (직접 쿼리가 필요한 경우)
const pgConnectionString = config.PG_CONNECTION_STRING;
const pool = new Pool({
  connectionString: pgConnectionString,
});

// DB 연결 테스트 함수
async function testConnection() {
  try {
    console.log('Supabase 연결 테스트 중...');

    // 1. Supabase API 연결 테스트
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      console.error('Supabase API 연결 실패:', sessionError.message);
      return false;
    }

    // 2. PostgreSQL 직접 연결 테스트
    try {
      const client = await pool.connect();
      try {
        const res = await client.query('SELECT NOW()');
        console.log('PostgreSQL 연결 성공. 서버 시간:', res.rows[0].now);
      } finally {
        client.release();
      }
    } catch (pgError) {
      console.error('PostgreSQL 연결 실패:', pgError.message);
      return false;
    }

    console.log('Supabase 연결 성공!');
    return true;
  } catch (error) {
    console.error('Supabase 연결 오류:', error.message);
    return false;
  }
}

// 스키마 생성 함수
async function createSchema() {
  try {
    // 스키마 SQL 파일 로드
    const schemaPath = path.join(__dirname, 'schema.sql');
    if (!fs.existsSync(schemaPath)) {
      console.error('스키마 파일을 찾을 수 없습니다:', schemaPath);
      return false;
    }

    // SQL 실행
    const sql = fs.readFileSync(schemaPath, 'utf8');
    const client = await pool.connect();

    try {
      console.log('스키마 생성 시작...');

      // 오류가 발생해도 계속 진행하도록 트랜잭션 사용
      await client.query('BEGIN');

      try {
        // SQL 문을 여러 명령으로 분리하여 실행
        const commands = sql.split(';').filter(cmd => cmd.trim() !== '');

        for (const command of commands) {
          try {
            await client.query(command);
          } catch (cmdError) {
            console.warn(`명령 실행 중 오류 (계속 진행): ${cmdError.message}`);
            console.warn(`문제된 명령: ${command.trim().substring(0, 100)}...`);
          }
        }

        await client.query('COMMIT');
        console.log('데이터베이스 스키마 생성 완료');
      } catch (sqlError) {
        await client.query('ROLLBACK');
        console.error('스키마 생성 중 오류 발생, 롤백됨:', sqlError.message);
        throw sqlError;
      }

      // 카테고리 테이블 확인 및 초기 데이터 삽입 재시도
      try {
        const checkCategoriesResult = await client.query("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'categories')");

        if (checkCategoriesResult.rows[0].exists) {
          console.log('카테고리 테이블 존재 확인됨');

          // 카테고리 테이블 데이터 확인
          const categoryCount = await client.query('SELECT COUNT(*) FROM categories');

          if (parseInt(categoryCount.rows[0].count) === 0) {
            console.log('카테고리 테이블에 초기 데이터 삽입 시도...');
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
          console.warn('카테고리 테이블이 없습니다! 테이블 생성 시도...');
          await client.query(`
            CREATE TABLE IF NOT EXISTS categories (
              id SERIAL PRIMARY KEY,
              name TEXT NOT NULL,
              color TEXT NOT NULL
            );

            INSERT INTO categories (id, name, color)
            VALUES
              (1, '업무', '#4a6da7'),
              (2, '개인', '#8bc34a'),
              (3, '아이디어', '#ff9800'),
              (4, '할일', '#9c27b0')
            ON CONFLICT (id) DO NOTHING
          `);
        }
      } catch (tableFixError) {
        console.error('카테고리 테이블 수정 중 오류:', tableFixError.message);
      }

      return true;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('스키마 생성 오류:', error.message);
    return false;
  }
}

// 메모 저장 함수
async function saveMemoToDb(memo) {
  try {
    // 현재 로그인한 사용자 정보 가져오기
    const userResult = await getCurrentUser();
    const userId = userResult.success && userResult.user ? userResult.user.id : null;

    // 카테고리 ID 처리
    let categoryId = memo.categoryId;

    // 타입 체크 및 변환 (정수 타입인지 확인)
    if (typeof categoryId === 'string' && categoryId.trim() !== '') {
      const parsedId = parseInt(categoryId, 10);
      categoryId = !Number.isNaN(parsedId) ? parsedId : null;
      console.log(`Supabase: 문자열 카테고리 ID를 숫자로 변환: "${memo.categoryId}" → ${categoryId}`);
    }

    // 특수 문자열 및 비정상 값 체크
    if (categoryId === '[NULL]' || categoryId === 'null' || categoryId === '') {
      categoryId = null;
      console.log(`Supabase: 특수 문자열 카테고리 ID를 null로 처리: "${memo.categoryId}"`);
    }

    // 데이터베이스에 저장할 데이터 로깅
    console.log(`Supabase: 메모 ID ${memo.id} 저장 시도, 카테고리 ID: ${categoryId}, 타입: ${typeof categoryId}`);

    const { data, error } = await supabase
      .from('memos')
      .upsert({
        id: memo.id,
        text: memo.text,
        is_widget: memo.isWidget || false,
        category_id: categoryId, // 처리된 카테고리 ID 사용
        priority: memo.priority || 0,
        tags: memo.tags || [],
        color: memo.color,
        reminder: memo.reminder,
        images: memo.images || [],
        created_at: memo.createdAt || new Date().toISOString(),
        updated_at: new Date().toISOString(),
        widget_position: memo.widgetPosition,
        widget_size: memo.widgetSize,
        user_id: userId // 사용자 ID 추가
      });

    if (error) {
      console.error(`Supabase: 메모 저장 오류 발생:`, error);
      throw error;
    }

    console.log(`Supabase: 메모 ID ${memo.id} 저장 성공`);
    return { success: true, data };
  } catch (error) {
    console.error('Supabase: 메모 저장 오류:', error.message);
    return { success: false, error: error.message };
  }
}

// 메모 목록 가져오기 함수
async function getMemosFromDb() {
  try {
    // 현재 로그인한 사용자 정보 가져오기
    const userResult = await getCurrentUser();
    const userId = userResult.success && userResult.user ? userResult.user.id : null;

    // 로그인하지 않은 경우 빈 배열 반환
    if (!userId) {
      console.log('로그인하지 않은 사용자: 빈 메모 목록 반환');
      return { success: true, memos: [] };
    }

    // 사용자 ID로 필터링하여 메모 가져오기
    const { data, error } = await supabase
      .from('memos')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // DB 결과를 앱 형식으로 변환
    const memos = data.map(memo => ({
      id: memo.id,
      text: memo.text,
      isWidget: memo.is_widget,
      categoryId: memo.category_id,
      priority: memo.priority,
      tags: memo.tags,
      color: memo.color,
      reminder: memo.reminder,
      images: memo.images,
      createdAt: memo.created_at,
      widgetPosition: memo.widget_position,
      widgetSize: memo.widget_size
    }));

    return { success: true, memos };
  } catch (error) {
    console.error('메모 로드 오류:', error.message);
    return { success: false, error: error.message };
  }
}

// 메모 삭제 함수
async function deleteMemoFromDb(memoId) {
  try {
    // 현재 로그인한 사용자 정보 가져오기
    const userResult = await getCurrentUser();
    const userId = userResult.success && userResult.user ? userResult.user.id : null;

    // 로그인하지 않은 경우 오류 반환
    if (!userId) {
      console.log('로그인하지 않은 사용자: 메모 삭제 불가');
      return { success: false, error: '로그인이 필요합니다.' };
    }

    // 사용자 ID로 필터링하여 메모 삭제
    const { error } = await supabase
      .from('memos')
      .delete()
      .eq('id', memoId)
      .eq('user_id', userId);  // 사용자 본인의 메모만 삭제 가능

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('메모 삭제 오류:', error.message);
    return { success: false, error: error.message };
  }
}

// 카테고리 저장 함수
async function saveCategoriesToDb(categories) {
  try {
    // 기존 카테고리 삭제 (또는 upsert로 처리할 수도 있음)
    const { error: deleteError } = await supabase
      .from('categories')
      .delete()
      .neq('id', 0); // 모든 카테고리 삭제

    if (deleteError) throw deleteError;

    // 새 카테고리 삽입
    const { error: insertError } = await supabase
      .from('categories')
      .insert(categories.map(cat => ({
        id: cat.id,
        name: cat.name,
        color: cat.color
      })));

    if (insertError) throw insertError;
    return { success: true };
  } catch (error) {
    console.error('카테고리 저장 오류:', error.message);
    return { success: false, error: error.message };
  }
}

// 카테고리 가져오기 함수
async function getCategoriesFromDb() {
  try {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('id');

    if (error) throw error;
    return { success: true, categories: data };
  } catch (error) {
    console.error('카테고리 로드 오류:', error.message);
    return { success: false, error: error.message };
  }
}

// 태그 관리 함수들
async function saveTagsToDb(tags) {
  try {
    const { error } = await supabase
      .from('tags')
      .delete();

    if (error) throw error;

    if (tags.length > 0) {
      const { error: insertError } = await supabase
        .from('tags')
        .insert(tags.map(tag => ({ name: tag })));

      if (insertError) throw insertError;
    }

    return { success: true };
  } catch (error) {
    console.error('태그 저장 오류:', error.message);
    return { success: false, error: error.message };
  }
}

async function getTagsFromDb() {
  try {
    const { data, error } = await supabase
      .from('tags')
      .select('name')
      .order('name');

    if (error) throw error;
    return { success: true, tags: data.map(t => t.name) };
  } catch (error) {
    console.error('태그 로드 오류:', error.message);
    return { success: false, error: error.message };
  }
}

// 구글 로그인 처리 함수
async function signInWithGoogle() {
  try {
    // Google OAuth 콜백을 위한 로컬 HTTP 서버로 리디렉션
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `http://localhost:8989`
      }
    });

    if (error) throw error;

    // 앱 내에서는 URL만 반환하고 브라우저는 main에서 열도록 함
    return { success: true, url: data.url };
  } catch (error) {
    console.error('Google 로그인 오류:', error.message);
    return { success: false, error: error.message };
  }
}

// 현재 로그인 상태 확인
async function getCurrentUser() {
  try {
    // 1단계: 현재 세션 확인
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

    // 세션 오류 처리
    if (sessionError) {
      console.error('세션 확인 오류:', sessionError.message);
      throw sessionError;
    }

    // 세션이 없으면 로그인 안 됨
    if (!sessionData || !sessionData.session) {
      console.log('유효한 세션 없음, 재인증 필요');
      return { success: false, error: '세션이 없거나 만료됨' };
    }

    // 2단계: 유효한 세션이 있으면 사용자 정보 가져오기
    const { data, error } = await supabase.auth.getUser();

    if (error) {
      console.error('사용자 정보 가져오기 오류:', error.message);
      throw error;
    }

    if (!data || !data.user) {
      console.log('사용자 정보 없음');
      return { success: false, error: '사용자 정보가 없음' };
    }

    console.log('현재 로그인된 사용자:', data.user.email);
    return {
      success: true,
      user: data.user,
      session: sessionData.session
    };
  } catch (error) {
    console.error('사용자 정보 가져오기 오류:', error.message);
    return { success: false, error: error.message };
  }
}

// 로그아웃
async function signOut() {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('로그아웃 오류:', error.message);
    return { success: false, error: error.message };
  }
}

// 모듈 내보내기
module.exports = {
  supabase,
  pool,
  testConnection,
  createSchema,
  saveMemoToDb,
  getMemosFromDb,
  deleteMemoFromDb,
  saveCategoriesToDb,
  getCategoriesFromDb,
  saveTagsToDb,
  getTagsFromDb,
  signInWithGoogle,
  getCurrentUser,
  signOut
};
