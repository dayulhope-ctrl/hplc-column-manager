-- HPLC 칼럼 관리 플랫폼 DB 스키마 (axhub DB)
-- Supabase 운영 DB 의 실제 구조(2026-11-04 기준)를 그대로 옮겼다.
-- 앱이 켜질 때마다 실행되므로 모든 문장은 여러 번 실행해도 안전해야 한다.

CREATE TABLE IF NOT EXISTS admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  name text NOT NULL,
  last_login_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_name text NOT NULL,
  department text,
  session_token text NOT NULL UNIQUE,
  ip_address text,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS column_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_name text NOT NULL,
  cat_no text NOT NULL,
  registration_date date,
  size text,
  particle_size numeric,
  total_stock integer DEFAULT 0,
  total_usage_count integer DEFAULT 0,
  min_safety_stock integer DEFAULT 2,
  unit_price integer DEFAULT 0,
  kep_code text,
  purchase_required boolean DEFAULT false,
  purchase_status text CHECK (purchase_status IS NULL OR purchase_status = ANY (ARRAY['발주 완료','입고 완료','구매 승인'])),
  purchase_quantity integer,
  order_date date,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  products_used jsonb DEFAULT '[]'::jsonb,
  is_draft boolean NOT NULL DEFAULT false,
  is_hidden boolean DEFAULT false,
  UNIQUE (model_name, cat_no)
);

CREATE TABLE IF NOT EXISTS purchase_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  column_model_id uuid REFERENCES column_models(id) ON DELETE CASCADE,
  requested_by text NOT NULL,
  department text,
  quantity integer NOT NULL DEFAULT 1,
  reason text,
  urgency text DEFAULT 'normal' CHECK (urgency = ANY (ARRAY['low','normal','high','urgent'])),
  status text DEFAULT 'pending' CHECK (status = ANY (ARRAY['pending','approved','rejected','ordered','received'])),
  reviewed_by text,
  reviewed_at timestamptz,
  review_notes text,
  ordered_at timestamptz,
  received_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  is_admin_direct boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS individual_columns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  column_code text,
  model_id uuid REFERENCES column_models(id) ON DELETE CASCADE,
  cat_no text,
  status text CHECK (status = ANY (ARRAY['사용 중','재고 대기','폐기 완료','입고 예정'])),
  start_date date,
  last_used_date date,
  user_name text,
  product_name text,
  test_item text,
  replacement_reason text,
  usage_reason text,
  usage_count integer DEFAULT 1,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS receiving_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  column_model_id uuid REFERENCES column_models(id) ON DELETE CASCADE,
  purchase_request_id uuid REFERENCES purchase_requests(id),
  order_date date,
  kep_code text,
  model_name text,
  cat_no text,
  size text,
  particle_size numeric,
  quantity integer NOT NULL,
  unit_price integer,
  total_price integer,
  receiving_date date NOT NULL,
  received_by text,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS monthly_closings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month text NOT NULL UNIQUE,
  closing_date date NOT NULL,
  total_quantity integer DEFAULT 0,
  total_price integer DEFAULT 0,
  records jsonb,
  closed_by text,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor text NOT NULL,
  actor_type text CHECK (actor_type = ANY (ARRAY['admin','user','system'])),
  action text NOT NULL,
  target_type text,
  target_id uuid,
  details jsonb,
  ip_address text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS column_test_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id uuid REFERENCES column_models(id) ON DELETE CASCADE,
  cat_no text,
  product_name text NOT NULL,
  test_item text,
  source text DEFAULT 'master_import_2026',
  created_at timestamptz DEFAULT now()
);
COMMENT ON TABLE column_test_mappings IS '칼럼모델별 시험품목/항목 매핑 (칼럼 마스터, LIMS 연동 기초)';

-- 데이터 이전 상태 기록용
CREATE TABLE IF NOT EXISTS _app_migrations (
  key text PRIMARY KEY,
  value text,
  at timestamptz DEFAULT now()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions (session_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_name ON user_sessions (user_name);
CREATE INDEX IF NOT EXISTS idx_individual_columns_model ON individual_columns (model_id);
CREATE INDEX IF NOT EXISTS idx_individual_columns_user ON individual_columns (user_name);
CREATE INDEX IF NOT EXISTS idx_receiving_records_date ON receiving_records (receiving_date DESC);
CREATE INDEX IF NOT EXISTS idx_monthly_closings_month ON monthly_closings (month DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_actor ON activity_logs (actor);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON activity_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_purchase_requests_status ON purchase_requests (status);
CREATE INDEX IF NOT EXISTS idx_purchase_requests_requester ON purchase_requests (requested_by);
CREATE INDEX IF NOT EXISTS idx_purchase_requests_created ON purchase_requests (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_column_models_name ON column_models (model_name);
CREATE INDEX IF NOT EXISTS idx_column_models_cat_no ON column_models (cat_no);
CREATE INDEX IF NOT EXISTS idx_column_models_kep ON column_models (kep_code);
CREATE INDEX IF NOT EXISTS idx_ctm_model_id ON column_test_mappings (model_id);
CREATE INDEX IF NOT EXISTS idx_ctm_product_name ON column_test_mappings (product_name);
CREATE INDEX IF NOT EXISTS idx_ctm_test_item ON column_test_mappings (test_item);

-- 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION increment_column_stock(col_id uuid, qty integer)
RETURNS integer LANGUAGE plpgsql AS $$
DECLARE
  new_stock INTEGER;
BEGIN
  UPDATE column_models
  SET total_stock = total_stock + qty
  WHERE id = col_id
  RETURNING total_stock INTO new_stock;

  IF new_stock IS NULL THEN
    RAISE EXCEPTION '칼럼을 찾을 수 없습니다: %', col_id;
  END IF;

  RETURN new_stock;
END;
$$;

CREATE OR REPLACE FUNCTION decrement_column_stock(col_id uuid, qty integer)
RETURNS integer LANGUAGE plpgsql AS $$
DECLARE
  new_stock INTEGER;
BEGIN
  UPDATE column_models
  SET total_stock = total_stock - qty
  WHERE id = col_id AND total_stock >= qty
  RETURNING total_stock INTO new_stock;

  IF new_stock IS NULL THEN
    RAISE EXCEPTION '재고 부족 또는 칼럼을 찾을 수 없습니다: %', col_id;
  END IF;

  RETURN new_stock;
END;
$$;

-- 트리거 (수정 시각 자동 갱신)
DROP TRIGGER IF EXISTS update_admins_updated_at ON admins;
CREATE TRIGGER update_admins_updated_at BEFORE UPDATE ON admins
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_column_models_updated_at ON column_models;
CREATE TRIGGER update_column_models_updated_at BEFORE UPDATE ON column_models
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_individual_columns_updated_at ON individual_columns;
CREATE TRIGGER update_individual_columns_updated_at BEFORE UPDATE ON individual_columns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_purchase_requests_updated_at ON purchase_requests;
CREATE TRIGGER update_purchase_requests_updated_at BEFORE UPDATE ON purchase_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- 칼럼 종류 (LC / GC) — 2026-11-12 추가
-- 처음 한 번만: 칸을 만들고 기존 칼럼을 사이즈로 자동 분류한다.
--   GC: 길이가 m 단위(예: 30m, 30 m)이거나 첫 숫자(내경)가 1 미만(예: 0.25 x 30)
--   나머지는 LC. 잘못 분류된 것은 관리자 화면에서 직접 옮긴다.
--   자동 분류는 '수정일'을 바꾸지 않도록 수정시각 트리거를 잠시 끈다.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'column_models' AND column_name = 'column_type'
  ) THEN
    ALTER TABLE column_models ADD COLUMN column_type text NOT NULL DEFAULT 'LC';
    ALTER TABLE column_models ADD CONSTRAINT column_models_column_type_check CHECK (column_type IN ('LC', 'GC'));
    ALTER TABLE column_models DISABLE TRIGGER update_column_models_updated_at;
    UPDATE column_models SET column_type = 'GC'
    WHERE size ~* '[0-9]\s*m([^m]|$)'
       OR substring(size from '[0-9]+(?:\.[0-9]+)?')::numeric < 1;
    ALTER TABLE column_models ENABLE TRIGGER update_column_models_updated_at;
  END IF;
END
$$;
CREATE INDEX IF NOT EXISTS idx_column_models_type ON column_models (column_type);
