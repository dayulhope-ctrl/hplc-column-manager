-- purchase_status 허용값에 '구매 승인' 추가 (구매요청 승인 시 사용)
ALTER TABLE column_models
  DROP CONSTRAINT IF EXISTS column_models_purchase_status_check;

ALTER TABLE column_models
  ADD CONSTRAINT column_models_purchase_status_check
  CHECK (purchase_status IS NULL OR purchase_status = ANY (
    ARRAY['발주 완료'::text, '입고 완료'::text, '구매 승인'::text]
  ));
