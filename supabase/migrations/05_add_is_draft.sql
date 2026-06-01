-- 구매요청으로 자동 생성된 임시 칼럼을 대시보드에서 숨기기 위한 필드
ALTER TABLE column_models
ADD COLUMN IF NOT EXISTS is_draft BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN column_models.is_draft IS '구매요청으로 자동 생성된 임시 칼럼 (승인 전까지 대시보드에서 숨김)';
