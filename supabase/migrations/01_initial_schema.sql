-- ============================================
-- HPLC 칼럼 관리 시스템 - 데이터베이스 스키마
-- ============================================

-- 1. 관리자 테이블
CREATE TABLE IF NOT EXISTS admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 팀원 세션 테이블 (이름 기반 접속 기록)
CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_name TEXT NOT NULL,
  department TEXT,
  session_token TEXT UNIQUE NOT NULL,
  ip_address TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_sessions_token ON user_sessions(session_token);
CREATE INDEX idx_user_sessions_name ON user_sessions(user_name);

-- 3. 칼럼 모델 테이블 (메인 재고 정보)
CREATE TABLE IF NOT EXISTS column_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_name TEXT NOT NULL,
  cat_no TEXT NOT NULL,
  registration_date DATE,
  size TEXT,
  particle_size NUMERIC(5,2),
  total_stock INTEGER DEFAULT 0,
  total_usage_count INTEGER DEFAULT 0,
  min_safety_stock INTEGER DEFAULT 2,
  unit_price INTEGER DEFAULT 0,
  kep_code TEXT,
  purchase_required BOOLEAN DEFAULT FALSE,
  purchase_status TEXT CHECK (purchase_status IN ('요청', '승인 대기', '발주 완료', '입고 완료')),
  purchase_quantity INTEGER,
  order_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(model_name, cat_no)
);

CREATE INDEX idx_column_models_name ON column_models(model_name);
CREATE INDEX idx_column_models_cat_no ON column_models(cat_no);
CREATE INDEX idx_column_models_kep ON column_models(kep_code);

-- 4. 개별 칼럼 사용 이력 테이블
CREATE TABLE IF NOT EXISTS individual_columns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  column_code TEXT,
  model_id UUID REFERENCES column_models(id) ON DELETE CASCADE,
  cat_no TEXT,
  status TEXT CHECK (status IN ('사용 중', '재고 대기', '폐기 완료', '입고 예정')),
  start_date DATE,
  last_used_date DATE,
  user_name TEXT,
  product_name TEXT,
  test_item TEXT,
  replacement_reason TEXT,
  usage_reason TEXT,
  usage_count INTEGER DEFAULT 1,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_individual_columns_model ON individual_columns(model_id);
CREATE INDEX idx_individual_columns_user ON individual_columns(user_name);

-- 5. 구매 요청 테이블 (팀원이 요청)
CREATE TABLE IF NOT EXISTS purchase_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  column_model_id UUID REFERENCES column_models(id) ON DELETE CASCADE,
  requested_by TEXT NOT NULL,
  department TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  reason TEXT,
  urgency TEXT DEFAULT 'normal' CHECK (urgency IN ('low', 'normal', 'high', 'urgent')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'ordered', 'received')),
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  ordered_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_purchase_requests_status ON purchase_requests(status);
CREATE INDEX idx_purchase_requests_requester ON purchase_requests(requested_by);
CREATE INDEX idx_purchase_requests_created ON purchase_requests(created_at DESC);

-- 6. 입고 기록 테이블
CREATE TABLE IF NOT EXISTS receiving_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  column_model_id UUID REFERENCES column_models(id) ON DELETE CASCADE,
  purchase_request_id UUID REFERENCES purchase_requests(id),
  order_date DATE,
  kep_code TEXT,
  model_name TEXT,
  cat_no TEXT,
  size TEXT,
  particle_size NUMERIC(5,2),
  quantity INTEGER NOT NULL,
  unit_price INTEGER,
  total_price INTEGER,
  receiving_date DATE NOT NULL,
  received_by TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_receiving_records_date ON receiving_records(receiving_date DESC);

-- 7. 월별 마감 테이블
CREATE TABLE IF NOT EXISTS monthly_closings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month TEXT NOT NULL UNIQUE, -- YYYY-MM 형식
  closing_date DATE NOT NULL,
  total_quantity INTEGER DEFAULT 0,
  total_price INTEGER DEFAULT 0,
  records JSONB, -- 마감 시점의 입고 기록 스냅샷
  closed_by TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_monthly_closings_month ON monthly_closings(month DESC);

-- 8. 활동 로그 테이블 (감사용)
CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor TEXT NOT NULL,
  actor_type TEXT CHECK (actor_type IN ('admin', 'user', 'system')),
  action TEXT NOT NULL,
  target_type TEXT,
  target_id UUID,
  details JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_activity_logs_actor ON activity_logs(actor);
CREATE INDEX idx_activity_logs_created ON activity_logs(created_at DESC);

-- ============================================
-- 트리거: updated_at 자동 업데이트
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_admins_updated_at BEFORE UPDATE ON admins
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_column_models_updated_at BEFORE UPDATE ON column_models
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_individual_columns_updated_at BEFORE UPDATE ON individual_columns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_purchase_requests_updated_at BEFORE UPDATE ON purchase_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- RLS (Row Level Security) - 모두 비활성화
-- Next.js API에서 권한 체크
-- ============================================
ALTER TABLE admins DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE column_models DISABLE ROW LEVEL SECURITY;
ALTER TABLE individual_columns DISABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE receiving_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_closings DISABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs DISABLE ROW LEVEL SECURITY;
