'use client';

import { useEffect, useState } from 'react';
import { ShoppingCart, Plus, Search, Send, Trash2 } from 'lucide-react';
import { ColumnModel, PurchaseRequest, UrgencyLevel } from '@/types';

// ── 통합 장바구니 아이템 ──
interface UnifiedCartItem {
  key: string;                                      // 고유 key
  type: 'approved' | 'direct';                      // approved=PATCH, direct=POST
  origin: 'approved' | 'low_stock' | 'manual';      // 뱃지 표시용
  modelName: string;
  catNo: string;
  kepCode: string | null;
  quantity: number;
  unitPrice: number;
  totalStock: number;
  // approved 전용
  purchaseRequestId?: string;
  requestedBy?: string;
  reason?: string;
  // direct 전용
  columnModelId?: string;
  urgency: UrgencyLevel;
  checked: boolean;
}

interface Props {
  columns: ColumnModel[];
  approvedRequests: PurchaseRequest[];
  adminName?: string;
  onOrderCompleted?: () => void;
  isAdmin?: boolean;
}

const URGENCY_OPTIONS = [
  { value: 'low',    label: '낮음' },
  { value: 'normal', label: '보통' },
  { value: 'high',   label: '높음' },
  { value: 'urgent', label: '긴급' },
];

const CART_KEY    = 'hplc_cart_v2';
const REMOVED_KEY = 'hplc_cart_removed_v2';

function OriginBadge({ origin }: { origin: 'approved' | 'low_stock' | 'manual' }) {
  if (origin === 'approved')
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">승인됨</span>;
  if (origin === 'low_stock')
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">재고부족</span>;
  return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">수동추가</span>;
}

function makeDirectItem(col: ColumnModel, origin: 'low_stock' | 'manual' = 'low_stock'): UnifiedCartItem {
  return {
    key: `direct_${col.id}`,
    type: 'direct',
    origin,
    modelName: col.model_name,
    catNo: col.cat_no,
    kepCode: col.kep_code,
    quantity: Math.max(1, col.min_safety_stock || 1),
    unitPrice: col.unit_price,
    totalStock: col.total_stock,
    columnModelId: col.id,
    reason: origin === 'low_stock' ? '재고 소진' : '',
    urgency: 'normal',
    checked: false,
  };
}

function makeApprovedItem(r: PurchaseRequest): UnifiedCartItem {
  return {
    key: `approved_${r.id}`,
    type: 'approved',
    origin: 'approved',
    modelName: r.column_models?.model_name || '',
    catNo: r.column_models?.cat_no || '',
    kepCode: r.column_models?.kep_code || null,
    quantity: r.quantity,
    unitPrice: r.column_models?.unit_price || 0,
    totalStock: r.column_models?.total_stock || 0,
    purchaseRequestId: r.id,
    requestedBy: r.requested_by,
    reason: r.reason || '',
    columnModelId: r.column_model_id,
    urgency: 'normal',
    checked: false,
  };
}

export default function CartTab({
  columns, approvedRequests, adminName, onOrderCompleted, isAdmin = true,
}: Props) {
  const [unifiedCart, setUnifiedCart] = useState<UnifiedCartItem[]>([]);
  const [initialized, setInitialized]   = useState(false);
  const [manuallyRemovedIds, setManuallyRemovedIds] = useState<Set<string>>(new Set());
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery]   = useState('');
  const [submitting, setSubmitting]     = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // 메시지 자동 소거
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 4000);
    return () => clearTimeout(t);
  }, [message]);

  // ── localStorage 저장 (direct 항목만) ──
  useEffect(() => {
    if (!initialized) return;
    const data = unifiedCart
      .filter(i => i.type === 'direct')
      .map(i => ({ id: i.columnModelId, qty: i.quantity, reason: i.reason || '', urgency: i.urgency, origin: i.origin }));
    localStorage.setItem(CART_KEY, JSON.stringify(data));
  }, [unifiedCart, initialized]);

  // ── 초기화: localStorage 복원 + 재고 0 자동 추가 ──
  useEffect(() => {
    if (columns.length === 0 || initialized) return;

    (async () => {
      // 수동 삭제 목록 복원
      let removedIds = new Set<string>();
      try {
        const raw = localStorage.getItem(REMOVED_KEY);
        if (raw) removedIds = new Set(JSON.parse(raw));
      } catch { /* 무시 */ }
      setManuallyRemovedIds(removedIds);

      // 전체 구매요청 조회 → pending/approved 상태인 칼럼은 자동 추가 금지
      let activeRequestColIds = new Set<string>();
      try {
        const res  = await fetch('/api/requests');
        const data = await res.json();
        const allRequests: { column_model_id: string; status: string }[] = data.requests || [];
        activeRequestColIds = new Set(
          allRequests
            .filter(r => ['pending', 'approved'].includes(r.status))
            .map(r => r.column_model_id)
        );
      } catch { /* 무시 */ }

      // direct 항목 복원 (localStorage)
      const directItems: UnifiedCartItem[] = [];
      const savedColumnIds = new Set<string>();
      try {
        const raw = localStorage.getItem(CART_KEY);
        if (raw) {
          const saved: { id: string; qty: number; reason: string; urgency: any; origin?: string }[] = JSON.parse(raw);
          for (const s of saved) {
            const col = columns.find(c => c.id === s.id);
            if (col) {
              directItems.push({
                key: `direct_${col.id}`,
                type: 'direct',
                origin: (s.origin as any) || 'manual',
                modelName: col.model_name,
                catNo: col.cat_no,
                kepCode: col.kep_code,
                quantity: s.qty,
                unitPrice: col.unit_price,
                totalStock: col.total_stock,
                columnModelId: col.id,
                reason: s.reason,
                urgency: s.urgency,
                checked: false,
              });
              savedColumnIds.add(col.id);
            }
          }
        }
      } catch { /* 무시 */ }

      // 재고 0 자동 추가
      // — 이미 저장된 것, 삭제된 것, 구매요청(pending/approved) 있는 것 제외
      const lowStockItems: UnifiedCartItem[] = columns
        .filter(c =>
          c.total_stock === 0 &&
          c.purchase_status !== '발주 완료' &&
          !savedColumnIds.has(c.id) &&
          !removedIds.has(c.id) &&
          !activeRequestColIds.has(c.id)  // ← pending·approved 구매요청 있으면 제외
        )
        .map(col => makeDirectItem(col, 'low_stock'));

      // localStorage 복원 direct 항목 중 구매요청 있는 것도 제거
      const filteredDirectItems = directItems.filter(i => !activeRequestColIds.has(i.columnModelId!));

      setUnifiedCart([...filteredDirectItems, ...lowStockItems]);
      setInitialized(true);
    })();
  }, [columns, initialized]);

  // ── approvedRequests 동기화 (초기화 이후) ──
  useEffect(() => {
    if (!initialized) return;
    setUnifiedCart(prev => {
      const approvedIds = new Set(approvedRequests.map(r => r.id));
      // 사라진 approved 항목 제거 (ordered/rejected 처리됨)
      const kept = prev.filter(item => item.type !== 'approved' || (item.purchaseRequestId && approvedIds.has(item.purchaseRequestId)));
      // 새로 추가된 approved 항목 병합
      const existingApprovedIds = new Set(kept.filter(i => i.type === 'approved').map(i => i.purchaseRequestId));
      const newApproved = approvedRequests
        .filter(r => r.status === 'approved' && !existingApprovedIds.has(r.id))
        .map(makeApprovedItem);

      // 새로 승인된 칼럼의 direct 항목 제거 (중복 방지)
      const newApprovedColIds = new Set(newApproved.map(i => i.columnModelId).filter(Boolean));
      const deduped = newApprovedColIds.size > 0
        ? kept.filter(i => i.type !== 'direct' || !newApprovedColIds.has(i.columnModelId))
        : kept;

      if (newApproved.length === 0 && deduped.length === prev.length) return prev;
      // approved 항목을 맨 위에 배치
      const directItems   = deduped.filter(i => i.type === 'direct');
      const approvedItems = deduped.filter(i => i.type === 'approved');
      return [...newApproved, ...approvedItems, ...directItems];
    });
  }, [approvedRequests, initialized]);

  // ── 새 재고 0 칼럼 동기화 (초기화 이후 columns 변경 시) ──
  // approved/pending 요청 있는 칼럼은 approvedRequests에서도 걸러짐 (existingColIds에 포함됨)
  useEffect(() => {
    if (!initialized || columns.length === 0) return;
    setUnifiedCart(prev => {
      // 장바구니에 이미 있는 칼럼 ID (approved 포함)
      const existingColIds = new Set(prev.map(i => i.columnModelId).filter(Boolean));
      // 현재 approvedRequests에 있는 칼럼도 제외 (pending 상태는 다음 승인 시 추가됨)
      const approvedColIds = new Set(approvedRequests.map(r => r.column_model_id));
      const newItems = columns
        .filter(c =>
          c.total_stock === 0 &&
          c.purchase_status !== '발주 완료' &&
          !existingColIds.has(c.id) &&
          !manuallyRemovedIds.has(c.id) &&
          !approvedColIds.has(c.id)
        )
        .map(col => makeDirectItem(col, 'low_stock'));
      return newItems.length > 0 ? [...prev, ...newItems] : prev;
    });
  }, [columns, initialized, manuallyRemovedIds, approvedRequests]);

  // ── 통합 발주 핸들러 ──
  const handleOrder = async () => {
    const targets = unifiedCart.some(i => i.checked)
      ? unifiedCart.filter(i => i.checked)
      : unifiedCart;
    if (targets.length === 0) return;
    if (!confirm(`선택된 ${targets.length}건을 발주 완료 처리하시겠습니까?`)) return;

    setSubmitting(true);
    try {
      const results = await Promise.all(targets.map(item => {
        if (item.type === 'approved' && item.purchaseRequestId) {
          return fetch(`/api/requests/${item.purchaseRequestId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'order' }),
          });
        }
        return fetch('/api/requests', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            column_model_id: item.columnModelId,
            quantity: item.quantity,
            reason: item.reason || '재고 소진 직접 발주',
            urgency: item.urgency,
            initial_status: 'ordered',
            requester_name: adminName,
          }),
        });
      }));

      const failCount = results.filter(r => !r.ok).length;
      if (failCount === 0) {
        setMessage({ type: 'success', text: `${targets.length}건 발주 완료 처리되었습니다` });
        const orderedKeys = new Set(targets.map(i => i.key));
        setUnifiedCart(prev => prev.filter(i => !orderedKeys.has(i.key)));
        // direct 발주 완료 항목은 removed 목록에서 제거 (purchase_status 변경으로 자동 추가 안 됨)
        const directOrdered = targets.filter(i => i.type === 'direct' && i.columnModelId);
        if (directOrdered.length > 0) {
          setManuallyRemovedIds(prev => {
            const next = new Set(prev);
            directOrdered.forEach(i => next.delete(i.columnModelId!));
            localStorage.setItem(REMOVED_KEY, JSON.stringify([...next]));
            return next;
          });
        }
        onOrderCompleted?.();
      } else {
        setMessage({ type: 'error', text: `${failCount}건 처리 실패` });
      }
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message || '발주 처리 실패' });
    } finally {
      setSubmitting(false);
    }
  };

  // ── 삭제 ──
  const handleDelete = async (item: UnifiedCartItem) => {
    if (item.type === 'approved' && item.purchaseRequestId) {
      if (!confirm('이 구매 요청을 삭제하시겠습니까?\n(구매요청 탭에서도 삭제됩니다)')) return;
      const res = await fetch(`/api/requests/${item.purchaseRequestId}`, { method: 'DELETE' });
      if (res.ok) {
        setMessage({ type: 'success', text: '구매 요청이 삭제되었습니다' });
        onOrderCompleted?.();
      } else {
        setMessage({ type: 'error', text: '삭제 실패' });
      }
    } else if (item.type === 'direct' && item.columnModelId) {
      setUnifiedCart(prev => prev.filter(i => i.key !== item.key));
      setManuallyRemovedIds(prev => {
        const next = new Set(prev).add(item.columnModelId!);
        localStorage.setItem(REMOVED_KEY, JSON.stringify([...next]));
        return next;
      });
    }
  };

  // ── 체크박스 ──
  const allChecked = unifiedCart.length > 0 && unifiedCart.every(i => i.checked);
  const toggleAll  = () => setUnifiedCart(prev => prev.map(i => ({ ...i, checked: !allChecked })));
  const toggleItem = (key: string) =>
    setUnifiedCart(prev => prev.map(i => i.key === key ? { ...i, checked: !i.checked } : i));

  // ── 수량 / 긴급도 ──
  const updateQty = (key: string, delta: number) =>
    setUnifiedCart(prev => prev.map(i => i.key === key ? { ...i, quantity: Math.max(1, i.quantity + delta) } : i));
  const updateUrgency = (key: string, urgency: UrgencyLevel) =>
    setUnifiedCart(prev => prev.map(i => i.key === key ? { ...i, urgency } : i));

  // ── 수동 추가 ──
  const addToCart = (col: ColumnModel) => {
    if (unifiedCart.some(i => i.columnModelId === col.id)) return;
    setUnifiedCart(prev => [...prev, makeDirectItem(col, 'manual')]);
    // 수동 추가 시 removed 목록에서 제거
    setManuallyRemovedIds(prev => {
      if (!prev.has(col.id)) return prev;
      const next = new Set(prev);
      next.delete(col.id);
      localStorage.setItem(REMOVED_KEY, JSON.stringify([...next]));
      return next;
    });
    setShowAddModal(false);
    setSearchQuery('');
  };

  const availableToAdd = columns.filter(col =>
    !unifiedCart.some(i => i.columnModelId === col.id) &&
    (searchQuery === '' ||
      col.model_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      col.cat_no.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const checkedCount   = unifiedCart.filter(i => i.checked).length;
  const totalEstimate  = unifiedCart.reduce((s, i) => s + i.quantity * i.unitPrice, 0);

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <ShoppingCart className="w-5 h-5" />
          장바구니
          <span className="text-sm font-normal text-gray-500">({unifiedCart.length}건)</span>
        </h2>
        {isAdmin && (
          <button
            onClick={() => setShowAddModal(true)}
            className="px-3 py-1.5 bg-gray-700 text-white rounded-lg hover:bg-gray-800 flex items-center gap-1.5 text-sm"
          >
            <Plus className="w-4 h-4" /> 수동 추가
          </button>
        )}
      </div>

      {/* 메시지 */}
      {message && (
        <div className={`p-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {message.text}
        </div>
      )}

      {/* 범례 */}
      <div className="flex items-center gap-3 text-xs text-gray-500">
        <span className="font-medium">구분:</span>
        <OriginBadge origin="approved" />
        <span>팀원 구매요청 승인됨</span>
        <OriginBadge origin="low_stock" />
        <span>재고 0 자동 추가</span>
        <OriginBadge origin="manual" />
        <span>직접 추가</span>
      </div>

      {/* 통합 테이블 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {unifiedCart.length === 0 ? (
          <div className="p-12 text-center text-gray-400 text-sm">
            <ShoppingCart className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            <p>장바구니가 비어 있습니다</p>
            <p className="text-xs mt-1">재고 0 칼럼이 있으면 자동으로 추가되고, 팀원의 구매요청을 승인하면 여기에 나타납니다</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-600 border-b">
                  <tr>
                    {isAdmin && (
                      <th className="px-3 py-2.5 text-center w-10">
                        <input type="checkbox" checked={allChecked} onChange={toggleAll} className="rounded" />
                      </th>
                    )}
                    <th className="px-3 py-2.5 text-left">구분</th>
                    <th className="px-3 py-2.5 text-left">모델명</th>
                    <th className="px-3 py-2.5 text-left">Cat. No</th>
                    <th className="px-3 py-2.5 text-left">KEP 코드</th>
                    <th className="px-3 py-2.5 text-center">수량</th>
                    <th className="px-3 py-2.5 text-right">단가</th>
                    <th className="px-3 py-2.5 text-right">합계</th>
                    <th className="px-3 py-2.5 text-center">재고</th>
                    <th className="px-3 py-2.5 text-left">긴급도</th>
                    {isAdmin && <th className="px-3 py-2.5 text-center">삭제</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {unifiedCart.map(item => (
                    <tr key={item.key} className={`hover:bg-gray-50 transition-colors ${item.checked ? 'bg-blue-50/40' : ''}`}>
                      {isAdmin && (
                        <td className="px-3 py-2.5 text-center">
                          <input type="checkbox" checked={item.checked} onChange={() => toggleItem(item.key)} className="rounded" />
                        </td>
                      )}
                      <td className="px-3 py-2.5">
                        <OriginBadge origin={item.origin} />
                        {item.origin === 'approved' && item.requestedBy && (
                          <div className="text-xs text-gray-400 mt-0.5">{item.requestedBy}</div>
                        )}
                      </td>
                      <td className="px-3 py-2.5 font-medium text-gray-900">{item.modelName}</td>
                      <td className="px-3 py-2.5 font-mono text-xs text-gray-600">{item.catNo}</td>
                      <td className="px-3 py-2.5 font-mono text-xs text-gray-600">{item.kepCode || '-'}</td>
                      <td className="px-3 py-2.5">
                        {isAdmin && item.type === 'direct' ? (
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => updateQty(item.key, -1)} className="w-6 h-6 rounded border flex items-center justify-center hover:bg-gray-100 text-xs">－</button>
                            <span className="w-8 text-center font-semibold">{item.quantity}</span>
                            <button onClick={() => updateQty(item.key, 1)} className="w-6 h-6 rounded border flex items-center justify-center hover:bg-gray-100 text-xs">＋</button>
                          </div>
                        ) : (
                          <span className="block text-center font-semibold">{item.quantity}</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right text-gray-700">₩{item.unitPrice.toLocaleString()}</td>
                      <td className="px-3 py-2.5 text-right font-semibold text-blue-700">
                        ₩{(item.quantity * item.unitPrice).toLocaleString()}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${item.totalStock === 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                          재고 {item.totalStock}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        {isAdmin && item.type === 'direct' ? (
                          <select
                            value={item.urgency}
                            onChange={e => updateUrgency(item.key, e.target.value as UrgencyLevel)}
                            className="px-1.5 py-0.5 border rounded text-xs bg-white"
                          >
                            {URGENCY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>
                      {isAdmin && (
                        <td className="px-3 py-2.5 text-center">
                          <button
                            onClick={() => handleDelete(item)}
                            className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            title={item.type === 'approved' ? '구매요청 삭제' : '장바구니에서 제거'}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 하단 액션바 */}
            {isAdmin && (
              <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
                <span className="text-sm text-gray-600">
                  {checkedCount > 0 ? `${checkedCount}개 선택됨` : `전체 ${unifiedCart.length}개`}
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-600">
                    예상 합계: <span className="text-blue-700 font-bold">₩{totalEstimate.toLocaleString()}</span>
                  </span>
                  <button
                    onClick={handleOrder}
                    disabled={submitting}
                    className="px-4 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5 text-sm font-semibold"
                  >
                    <Send className="w-4 h-4" />
                    {submitting ? '처리 중...' : `발주완료 (${checkedCount > 0 ? checkedCount : unifiedCart.length})`}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* 칼럼 수동 추가 모달 */}
      {isAdmin && showAddModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[80vh] flex flex-col shadow-xl">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-bold">칼럼 선택 (수동 추가)</h3>
              <button
                onClick={() => { setShowAddModal(false); setSearchQuery(''); }}
                className="p-1 hover:bg-gray-100 rounded text-gray-500"
              >✕</button>
            </div>
            <div className="p-3 border-b">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="모델명 또는 Cat. No 검색..."
                  className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm"
                  autoFocus
                />
              </div>
            </div>
            <div className="overflow-y-auto flex-1 p-2">
              {availableToAdd.length === 0 ? (
                <p className="text-center text-gray-400 py-8 text-sm">검색 결과가 없습니다</p>
              ) : availableToAdd.map(col => (
                <button
                  key={col.id}
                  onClick={() => addToCart(col)}
                  className="w-full text-left p-3 hover:bg-blue-50 rounded-lg flex items-center justify-between transition-colors"
                >
                  <div>
                    <div className="font-medium text-sm">{col.model_name}</div>
                    <div className="text-xs text-gray-500 font-mono">{col.cat_no}</div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${col.total_stock === 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                    재고 {col.total_stock}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
