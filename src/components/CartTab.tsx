'use client';

import { useEffect, useState } from 'react';
import { ShoppingCart, Plus, Search, Send, PackageCheck, Truck } from 'lucide-react';
import { ColumnModel, PurchaseRequest } from '@/types';

// ── 섹션 B: 재고부족 칼럼 장바구니 ──
interface CartItem {
  column: ColumnModel;
  quantity: number;
  reason: string;
  urgency: 'low' | 'normal' | 'high' | 'urgent';
  checked: boolean;
}

interface Props {
  columns: ColumnModel[];
  approvedRequests: PurchaseRequest[];   // 섹션 A: 승인된 구매요청
  adminName?: string;
  onOrderCompleted?: () => void;
  isAdmin?: boolean;
}

const URGENCY_OPTIONS = [
  { value: 'low', label: '낮음' },
  { value: 'normal', label: '보통' },
  { value: 'high', label: '높음' },
  { value: 'urgent', label: '긴급' },
];

const CART_KEY = 'hplc_cart_v2';

function makeItem(col: ColumnModel): CartItem {
  return {
    column: col,
    quantity: Math.max(1, col.min_safety_stock || 1),
    reason: '재고 소진',
    urgency: 'normal',
    checked: false,
  };
}

export default function CartTab({ columns, approvedRequests, adminName, onOrderCompleted, isAdmin = true }: Props) {
  // ── 섹션 B 상태 ──
  const [cart, setCart] = useState<CartItem[]>([]);
  const [initialized, setInitialized] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // ── 공통 상태 ──
  const [submittingA, setSubmittingA] = useState<Set<string>>(new Set());
  const [submittingB, setSubmittingB] = useState(false);
  const [checkedB, setCheckedB] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (message) {
      const t = setTimeout(() => setMessage(null), 4000);
      return () => clearTimeout(t);
    }
  }, [message]);

  // localStorage 저장
  useEffect(() => {
    if (!initialized) return;
    const data = cart.map(i => ({ id: i.column.id, qty: i.quantity, reason: i.reason, urgency: i.urgency }));
    localStorage.setItem(CART_KEY, JSON.stringify(data));
  }, [cart, initialized]);

  // 초기화: localStorage 복원 + 재고 0 항목 병합
  useEffect(() => {
    if (columns.length === 0) return;
    if (initialized) {
      setCart(prev => {
        const ids = new Set(prev.map(i => i.column.id));
        const newItems = columns.filter(c => c.total_stock === 0 && !ids.has(c.id)).map(makeItem);
        return newItems.length > 0 ? [...prev, ...newItems] : prev;
      });
      return;
    }
    const saved = localStorage.getItem(CART_KEY);
    const restored: CartItem[] = [];
    const savedIds = new Set<string>();
    if (saved) {
      try {
        const items: { id: string; qty: number; reason: string; urgency: any }[] = JSON.parse(saved);
        for (const item of items) {
          const col = columns.find(c => c.id === item.id);
          if (col) {
            restored.push({ column: col, quantity: item.qty, reason: item.reason, urgency: item.urgency, checked: false });
            savedIds.add(item.id);
          }
        }
      } catch { /* 파싱 실패 무시 */ }
    }
    const newItems = columns.filter(c => c.total_stock === 0 && !savedIds.has(c.id)).map(makeItem);
    setCart([...restored, ...newItems]);
    setInitialized(true);
  }, [columns]);

  // ── 섹션 A: 승인된 요청 → 발주 ──
  const handleOrderApproved = async (requestId: string) => {
    if (!confirm('이 항목을 발주 완료 처리하시겠습니까?')) return;
    setSubmittingA(prev => new Set(prev).add(requestId));
    try {
      const res = await fetch(`/api/requests/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'order' }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setMessage({ type: 'success', text: '발주 완료 처리되었습니다' });
      onOrderCompleted?.();
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message });
    } finally {
      setSubmittingA(prev => { const s = new Set(prev); s.delete(requestId); return s; });
    }
  };

  const handleOrderAllApproved = async () => {
    if (approvedRequests.length === 0) return;
    if (!confirm(`승인된 구매요청 ${approvedRequests.length}건을 모두 발주 완료 처리하시겠습니까?`)) return;
    setSubmittingA(new Set(approvedRequests.map(r => r.id)));
    try {
      await Promise.all(approvedRequests.map(r =>
        fetch(`/api/requests/${r.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'order' }),
        })
      ));
      setMessage({ type: 'success', text: `${approvedRequests.length}건 발주 완료 처리되었습니다` });
      onOrderCompleted?.();
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message });
    } finally {
      setSubmittingA(new Set());
    }
  };

  // ── 섹션 B: 재고부족 칼럼 → 직접 발주 ──
  const allCheckedB = cart.length > 0 && cart.every(i => checkedB.has(i.column.id));
  const toggleAllB = () => {
    if (allCheckedB) setCheckedB(new Set());
    else setCheckedB(new Set(cart.map(i => i.column.id)));
  };
  const toggleItemB = (id: string) => {
    setCheckedB(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  };

  const handleDirectOrder = async () => {
    const targets = checkedB.size > 0 ? cart.filter(i => checkedB.has(i.column.id)) : cart;
    if (targets.length === 0) return;
    if (!confirm(`재고부족 칼럼 ${targets.length}건을 직접 발주 처리하시겠습니까?`)) return;
    setSubmittingB(true);
    const results = await Promise.all(
      targets.map(item =>
        fetch('/api/requests', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            column_model_id: item.column.id,
            quantity: item.quantity,
            reason: item.reason || '재고 소진 직접 발주',
            urgency: item.urgency,
            initial_status: 'ordered',   // 관리자 직접 발주
            requester_name: adminName,
          }),
        })
      )
    );
    const failCount = results.filter(r => !r.ok).length;
    setSubmittingB(false);
    if (failCount === 0) {
      setMessage({ type: 'success', text: `${targets.length}건 발주 완료 처리되었습니다` });
      setCart(prev => prev.filter(i => !targets.some(t => t.column.id === i.column.id)));
      setCheckedB(new Set());
      onOrderCompleted?.();
    } else {
      setMessage({ type: 'error', text: `${failCount}건 처리 실패` });
    }
  };

  const updateQty = (id: string, delta: number) =>
    setCart(prev => prev.map(i => i.column.id === id ? { ...i, quantity: Math.max(1, i.quantity + delta) } : i));

  const removeFromCart = (id: string) => setCart(prev => prev.filter(i => i.column.id !== id));

  const addToCart = (col: ColumnModel) => {
    if (cart.some(item => item.column.id === col.id)) return;
    setCart(prev => [...prev, { column: col, quantity: Math.max(1, col.min_safety_stock || 1), reason: '', urgency: 'normal', checked: false }]);
    setShowAddModal(false);
    setSearchQuery('');
  };

  const availableToAdd = columns.filter(col =>
    !cart.some(item => item.column.id === col.id) &&
    (searchQuery === '' ||
      col.model_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      col.cat_no.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const totalEstimateB = cart.reduce((sum, item) => sum + item.quantity * item.column.unit_price, 0);
  const checkedCountB = checkedB.size;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <ShoppingCart className="w-5 h-5" />
          장바구니
        </h2>
      </div>

      {message && (
        <div className={`p-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {message.text}
        </div>
      )}

      {/* ── 섹션 A: 승인된 구매요청 ── */}
      <div className="bg-white rounded-xl border border-blue-200 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-blue-50 border-b border-blue-100">
          <div className="flex items-center gap-2">
            <PackageCheck className="w-4 h-4 text-blue-600" />
            <span className="font-semibold text-sm text-blue-900">승인된 구매요청</span>
            <span className="text-xs text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">{approvedRequests.length}건</span>
          </div>
          {isAdmin && approvedRequests.length > 0 && (
            <button
              onClick={handleOrderAllApproved}
              disabled={submittingA.size > 0}
              className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              전체 발주완료
            </button>
          )}
        </div>

        {approvedRequests.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">
            <PackageCheck className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            승인된 구매요청이 없습니다
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-600 border-b">
                <tr>
                  <th className="px-4 py-2 text-left">요청일</th>
                  <th className="px-4 py-2 text-left">요청자</th>
                  <th className="px-4 py-2 text-left">모델명</th>
                  <th className="px-4 py-2 text-left">Cat. No</th>
                  <th className="px-4 py-2 text-center">수량</th>
                  <th className="px-4 py-2 text-left">사유</th>
                  {isAdmin && <th className="px-4 py-2 text-center">발주</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {approvedRequests.map(req => (
                  <tr key={req.id} className="hover:bg-blue-50/50">
                    <td className="px-4 py-2 text-xs text-gray-500">{new Date(req.created_at).toLocaleDateString('ko-KR')}</td>
                    <td className="px-4 py-2 text-xs font-medium">{req.requested_by}</td>
                    <td className="px-4 py-2 font-medium text-gray-900">{req.column_models?.model_name}</td>
                    <td className="px-4 py-2 font-mono text-xs text-gray-500">{req.column_models?.cat_no}</td>
                    <td className="px-4 py-2 text-center font-semibold">{req.quantity}</td>
                    <td className="px-4 py-2 text-xs text-gray-500">{req.reason || '-'}</td>
                    {isAdmin && (
                      <td className="px-4 py-2 text-center">
                        <button
                          onClick={() => handleOrderApproved(req.id)}
                          disabled={submittingA.has(req.id)}
                          className="px-2.5 py-1 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1 mx-auto"
                        >
                          <Send className="w-3 h-3" />
                          발주완료
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── 섹션 B: 재고부족 칼럼 직접 발주 ── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b">
          <div className="flex items-center gap-2">
            <Truck className="w-4 h-4 text-gray-500" />
            <span className="font-semibold text-sm text-gray-800">재고부족 직접 발주</span>
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{cart.length}건</span>
            <span className="text-xs text-gray-400">(재고 0 칼럼 자동 추가)</span>
          </div>
          {isAdmin && (
            <button onClick={() => setShowAddModal(true)}
              className="px-3 py-1.5 bg-gray-700 text-white rounded-lg hover:bg-gray-800 flex items-center gap-1.5 text-sm">
              <Plus className="w-4 h-4" /> 수동 추가
            </button>
          )}
        </div>

        {cart.length === 0 ? (
          <div className="p-10 text-center text-gray-400 text-sm">
            <ShoppingCart className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            재고 0개 칼럼이 없습니다
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-600 border-b">
                  <tr>
                    {isAdmin && (
                      <th className="px-3 py-2 text-center w-10">
                        <input type="checkbox" checked={allCheckedB} onChange={toggleAllB} className="rounded" />
                      </th>
                    )}
                    <th className="px-3 py-2 text-left">모델명</th>
                    <th className="px-3 py-2 text-left">Cat. No</th>
                    <th className="px-3 py-2 text-left">KEP 코드</th>
                    <th className="px-3 py-2 text-center">구매수량</th>
                    <th className="px-3 py-2 text-right">단가</th>
                    <th className="px-3 py-2 text-right">합계</th>
                    <th className="px-3 py-2 text-center">재고</th>
                    <th className="px-3 py-2 text-left">긴급도</th>
                    {isAdmin && <th className="px-3 py-2 text-center">삭제</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {cart.map(item => (
                    <tr key={item.column.id} className={`hover:bg-gray-50 ${checkedB.has(item.column.id) ? 'bg-amber-50' : ''}`}>
                      {isAdmin && (
                        <td className="px-3 py-2 text-center">
                          <input type="checkbox" checked={checkedB.has(item.column.id)} onChange={() => toggleItemB(item.column.id)} className="rounded" />
                        </td>
                      )}
                      <td className="px-3 py-2 font-medium text-gray-900">{item.column.model_name}</td>
                      <td className="px-3 py-2 font-mono text-xs text-gray-600">{item.column.cat_no}</td>
                      <td className="px-3 py-2 font-mono text-xs text-gray-600">{item.column.kep_code || '-'}</td>
                      <td className="px-3 py-2">
                        {isAdmin ? (
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => updateQty(item.column.id, -1)} className="w-6 h-6 rounded border flex items-center justify-center hover:bg-gray-100 text-xs">－</button>
                            <span className="w-8 text-center font-semibold">{item.quantity}</span>
                            <button onClick={() => updateQty(item.column.id, 1)} className="w-6 h-6 rounded border flex items-center justify-center hover:bg-gray-100 text-xs">＋</button>
                          </div>
                        ) : (
                          <span className="block text-center font-semibold">{item.quantity}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right text-gray-700">₩{item.column.unit_price.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right font-semibold text-blue-700">₩{(item.quantity * item.column.unit_price).toLocaleString()}</td>
                      <td className="px-3 py-2 text-center">
                        <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">재고 {item.column.total_stock}</span>
                      </td>
                      <td className="px-3 py-2">
                        {isAdmin ? (
                          <select value={item.urgency}
                            onChange={e => setCart(prev => prev.map(i => i.column.id === item.column.id ? { ...i, urgency: e.target.value as any } : i))}
                            className="px-1.5 py-0.5 border rounded text-xs bg-white">
                            {URGENCY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        ) : (
                          <span className="text-xs text-gray-600">{URGENCY_OPTIONS.find(o => o.value === item.urgency)?.label}</span>
                        )}
                      </td>
                      {isAdmin && (
                        <td className="px-3 py-2 text-center">
                          <button onClick={() => removeFromCart(item.column.id)} className="text-xs text-red-400 hover:text-red-600 px-1.5 py-0.5 hover:bg-red-50 rounded">삭제</button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {isAdmin && (
              <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-600">{checkedCountB > 0 ? `${checkedCountB}개 선택됨` : `전체 ${cart.length}개`}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-600">
                    예상 합계: <span className="text-blue-700 font-bold">₩{totalEstimateB.toLocaleString()}</span>
                  </span>
                  <button
                    onClick={handleDirectOrder}
                    disabled={submittingB}
                    className="px-4 py-1.5 bg-gray-800 text-white rounded-lg hover:bg-gray-900 disabled:opacity-50 flex items-center gap-1.5 text-sm font-semibold"
                  >
                    <Send className="w-4 h-4" />
                    {submittingB ? '처리 중...' : `발주완료 (${checkedCountB > 0 ? checkedCountB : cart.length})`}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* 칼럼 추가 모달 */}
      {isAdmin && showAddModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[80vh] flex flex-col shadow-xl">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-bold">칼럼 선택</h3>
              <button onClick={() => { setShowAddModal(false); setSearchQuery(''); }} className="p-1 hover:bg-gray-100 rounded">✕</button>
            </div>
            <div className="p-3 border-b">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  placeholder="모델명 또는 Cat. No 검색..."
                  className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm" autoFocus />
              </div>
            </div>
            <div className="overflow-y-auto flex-1 p-2">
              {availableToAdd.length === 0 ? (
                <p className="text-center text-gray-400 py-8 text-sm">검색 결과가 없습니다</p>
              ) : availableToAdd.map(col => (
                <button key={col.id} onClick={() => addToCart(col)}
                  className="w-full text-left p-3 hover:bg-blue-50 rounded-lg flex items-center justify-between">
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
