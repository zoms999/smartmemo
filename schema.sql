-- 기존 테이블 삭제 옵션 (처음 실행 시 주석 해제)
-- DROP TABLE IF EXISTS memos CASCADE;
-- DROP TABLE IF EXISTS categories CASCADE;
-- DROP TABLE IF EXISTS tags CASCADE;

-- 메모 테이블
CREATE TABLE IF NOT EXISTS memos (
  id BIGINT PRIMARY KEY,
  text TEXT NOT NULL,
  is_widget BOOLEAN DEFAULT FALSE,
  category_id INTEGER,
  priority SMALLINT DEFAULT 0,
  tags TEXT[] DEFAULT '{}',
  color TEXT,
  reminder TIMESTAMP WITH TIME ZONE,
  images JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  widget_position JSONB,
  widget_size JSONB,
  user_id UUID REFERENCES auth.users(id)1747496670832
);

-- 카테고리 테이블
DROP TABLE IF EXISTS categories CASCADE;
CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL
);

-- 태그 테이블
CREATE TABLE IF NOT EXISTS tags (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

-- 초기 카테고리 데이터 삽입
INSERT INTO categories (id, name, color)
VALUES
  (1, '업무', '#4a6da7'),
  (2, '개인', '#8bc34a'),
  (3, '아이디어', '#ff9800'),
  (4, '할일', '#9c27b0')
ON CONFLICT (id) DO NOTHING;

-- 초기 태그 데이터 삽입
INSERT INTO tags (name)
VALUES
  ('중요'),
  ('긴급'),
  ('후속조치'),
  ('참고')
ON CONFLICT (name) DO NOTHING;

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_memos_created_at ON memos (created_at);
CREATE INDEX IF NOT EXISTS idx_memos_category_id ON memos (category_id);
CREATE INDEX IF NOT EXISTS idx_memos_priority ON memos (priority);
CREATE INDEX IF NOT EXISTS idx_memos_reminder ON memos (reminder);
CREATE INDEX IF NOT EXISTS idx_memos_user_id ON memos (user_id);

-- RLS(Row Level Security) 정책 설정
ALTER TABLE memos ENABLE ROW LEVEL SECURITY;

-- 사용자는 자신의 메모만 볼 수 있음
CREATE POLICY select_own_memos ON memos
    FOR SELECT
    USING (user_id = auth.uid());

-- 사용자는 자신의 메모만 삽입/수정/삭제 가능
CREATE POLICY insert_own_memos ON memos
    FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY update_own_memos ON memos
    FOR UPDATE
    USING (user_id = auth.uid());

CREATE POLICY delete_own_memos ON memos
    FOR DELETE
    USING (user_id = auth.uid());

-- 트리거 함수: 수정 시간 자동 업데이트
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 설정
DROP TRIGGER IF EXISTS set_updated_at ON memos;
CREATE TRIGGER set_updated_at
BEFORE UPDATE ON memos
FOR EACH ROW
EXECUTE FUNCTION trigger_set_updated_at();
