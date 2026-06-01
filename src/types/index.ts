// ============================================
// HPLC 칼럼 관리 시스템 - 타입 정의
// ============================================

export type ColumnStatus = '사용 중' | '재고 대기' | '폐기 완료' | '입고 예정';
// 실제 DB에서 사용하는 값 (04_fixes.sql 마이그레이션 이후)
export type PurchaseStatus = '발주 완료' | '입고 완료' | '구매 승인';
export type RequestStatus = 'pending' | 'approved' | 'rejected' | 'ordered' | 'received';
export type UrgencyLevel = 'low' | 'normal' | 'high' | 'urgent';

// 칼럼 모델
export interface ColumnModel {
  id: string;
  model_name: string;
  cat_no: string;
  registration_date: string | null;
  size: string | null;
  particle_size: number | null;
  total_stock: number;
  total_usage_count: number;
  min_safety_stock: number;
  unit_price: number;
  kep_code: string | null;
  purchase_required: boolean;
  purchase_status: PurchaseStatus | null;
  purchase_quantity: number | null;
  order_date: string | null;
  notes: string | null;
  products_used: string[] | null;
  created_at: string;
  updated_at: string;
}

// 개별 칼럼 사용 이력
export interface IndividualColumn {
  id: string;
  column_code: string | null;
  model_id: string;
  cat_no: string | null;
  status: ColumnStatus;
  start_date: string | null;
  last_used_date: string | null;
  user_name: string | null;
  product_name: string | null;
  test_item: string | null;
  replacement_reason: string | null;
  usage_reason: string | null;
  usage_count: number;
  notes: string | null;
}

// 구매 요청
export interface PurchaseRequest {
  id: string;
  column_model_id: string;
  requested_by: string;
  department: string | null;
  quantity: number;
  reason: string | null;
  urgency: UrgencyLevel;
  status: RequestStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  ordered_at: string | null;
  received_at: string | null;
  is_admin_direct: boolean;
  created_at: string;
  updated_at: string;
  // Join
  column_models?: ColumnModel;
}

// 입고 기록
export interface ReceivingRecord {
  id: string;
  column_model_id: string;
  purchase_request_id: string | null;
  order_date: string | null;
  kep_code: string | null;
  model_name: string;
  cat_no: string;
  size: string | null;
  particle_size: number | null;
  quantity: number;
  unit_price: number | null;
  total_price: number | null;
  receiving_date: string;
  received_by: string | null;
  notes: string | null;
  created_at: string;
}

// 월별 마감
export interface MonthlyClosing {
  id: string;
  month: string;
  closing_date: string;
  total_quantity: number;
  total_price: number;
  records: any;
  closed_by: string | null;
  notes: string | null;
  created_at: string;
}

// 사용자 세션
export interface UserSession {
  user_name: string;
  department: string | null;
  session_token: string;
  expires_at: string;
}

// 관리자 세션
export interface AdminSession {
  id: string;
  username: string;
  name: string;
  isAdmin: true;
}

// 대시보드 통계
export interface DashboardStats {
  totalModels: number;
  totalStock: number;
  purchaseRequiredCount: number;
  approvedRequestCount: number;
  orderCompletedCount: number;
  totalValue: number;
  pendingRequestsCount: number;
  lowStockCount: number;
}
