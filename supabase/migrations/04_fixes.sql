-- ============================================
-- 04_fixes.sql
-- 1) purchase_status CHECK 제약조건 정리
-- 2) 재고 원자적 증가 RPC 함수
-- 3) 재고 원자적 감소 RPC 함수
-- ============================================

-- ── 1. purchase_status CHECK 제약조건 정리 ──
-- 기존 제약조건 삭제 후, 실제 사용 값만 허용하도록 재생성
ALTER TABLE column_models
  DROP CONSTRAINT IF EXISTS column_models_purchase_status_check;

ALTER TABLE column_models
  ADD CONSTRAINT column_models_purchase_status_check
  CHECK (purchase_status IS NULL OR purchase_status IN ('발주 완료', '입고 완료'));

-- ── 2. 재고 원자적 증가 함수 ──
-- 입고 처리 시 race condition 방지용
CREATE OR REPLACE FUNCTION increment_column_stock(col_id UUID, qty INTEGER)
RETURNS INTEGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 3. 재고 원자적 감소 함수 (사용 처리 시 사용) ──
CREATE OR REPLACE FUNCTION decrement_column_stock(col_id UUID, qty INTEGER)
RETURNS INTEGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;
