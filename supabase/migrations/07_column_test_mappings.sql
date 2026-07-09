-- 칼럼 마스터: 칼럼모델 ↔ 시험품목 ↔ 시험항목 매핑 테이블
-- (LIMS 연동 기초공사 — "이 칼럼은 어떤 품목의 어떤 시험에 쓰이는가")
CREATE TABLE IF NOT EXISTS public.column_test_mappings (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id     UUID REFERENCES public.column_models(id) ON DELETE CASCADE,
  cat_no       TEXT,                    -- 매칭/역추적용 (denormalized)
  product_name TEXT NOT NULL,           -- 시험품목
  test_item    TEXT,                    -- 시험항목
  source       TEXT DEFAULT 'master_import_2026',
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ctm_model_id     ON public.column_test_mappings (model_id);
CREATE INDEX IF NOT EXISTS idx_ctm_product_name ON public.column_test_mappings (product_name);
CREATE INDEX IF NOT EXISTS idx_ctm_test_item    ON public.column_test_mappings (test_item);

COMMENT ON TABLE public.column_test_mappings IS '칼럼모델별 시험품목/항목 매핑 (칼럼 마스터, LIMS 연동 기초)';
