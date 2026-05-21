'use client';

import { useEffect, useState } from 'react';
import { ShoppingCart, Plus, Minus, Search, Send } from 'lucide-react';
import { ColumnModel } from '@/types';

interface CartItem {
  column: ColumnModel;
  quantity: number;
  reason: string;
  urgency: 'low' | 'normal' | 'high' | 'urgent';
  checked: boolean;
}

interface Props {
  columns: ColumnModel[];
  adminName?: string;
  onRequestCreated?: () => void;
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

export default function CartTab({ columns, adminName, onRequestCreated, isAdmin = true }: Props) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [initialized, setInitialized] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (message) {
      const t = setTimeout(() => setMessage(null), 4000);
      return () => clearTimeout(t);
    }
  }, [message]);

  // 장바구니 변경 시 localStorage에 저장
  useEffect(() => {
    if (!initialized) return;
    const data = cart.map(i => ({
      id: i.column.id, qty: i.quantity, reason: i.reason, urgency: i.urgency,
    }));
    localStorage.setItem(CART_KEY, JSON.stringify(data));
  }, [cart, initialized]);

  // 초기화: localStorage 복원 → 새 재고 0 항목 병합
  useEffect(() => {
    if (columns.length === 0) return;

    if (initialized) {
      // 이미 초기화됨 → 새로 재고 0이 된 항목만 추가
      setCart(prev => {
        const ids = new Set(prev.map(i => i.column.id));
        const newItems = columns.filter(c => c.total_stock === 0 && !ids.has(c.id)).map(makeItem);
        return newItems.length > 0 ? [...prev, ...newItems] : prev;
      });
      return;
    }

    // 첫 초기화: localStorage에서 복원
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
      } catch { /* 파싱 실패 시 무시 */ }
    }

    // localStorage에 없는 재고 0 항목 추가
    const newItems = columns.filter(c => c.total_stock === 0 && !savedIds.has(c.id)).map(makeItem);
    setCart([...restored, ...newItems]);
    setInitialized(true);
  }, [columns]);

  const allChecked = cart.length > 0 && cart.every(i => i.checked);
  const checkedCount = cart.filter(i => i.checked).length;

  const toggleAll = () => setCart(prev => prev.map(i => ({ ...i, checked: !allChecked })));
  const toggleItem = (id: string) => setCart(prev => prev.map(i => i.column.id === id ? { ...i, checked: !i.checked } : i));

  const addToCart = (col: ColumnModel) => {
    if (cart.some(item => item.column.id === col.id)) return;
    setCart(prev => [...prev, {
      column: col, quantity: Math.max(1, col.min_safety_stock || 1),
      reason: '', urgency: 'normal', checked: false,
    }]);
    setShowAddModal(false);
    setSearchQuery('');
  };

  const removeChecked = () => {
    if (checkedCount === 0) return;
    if (!confirm(`선택한 ${checkedCount}개 항목을 장바구니에서 삭제하시겠습니까?`)) return;
    setCart(prev => prev.filter(i => !i.checked));
  };

  const updateQty = (id: string, delta: number) => {
    setCart(prev => prev.map(i =>
      i.column.id === id ? { ...i, quantity: Math.max(1, i.quantity + delta) } : i
    ));
  };

  const handleSubmit = async () => {
    const targets = checkedCount > 0 ? cart.filter(i => i.checked) : cart;
    if (targets.length === 0) return;
    if (!confirm(`${targets.length}건의 구매 요청을 생성하시겠습니까?`)) return;
    setSubmitting(true);

    const results = await Promise.all(
      targets.map(item =>
        fetch('/api/requests', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            column_model_id: item.column.id,
            quantity: item.quantity,
            reason: item.reason || null,
            urgency: item.urgency,
          }),
        })
      )
    );

    const failCount = results.filter(r => !r.ok).length;
    setSubmitting(false);

    if (failCount === 0) {
      setMessage({ type: 'success', text: `${targets.length}건 구매 요청 완료` });
      setCart(prev => prev.filter(i => !targets.some(t => t.column.id === i.column.id)));
      onRequestCreated?.();
    } else {
      setMessage({ type: 'error', text: `${failCount}건 요청 생성 실패` });
    }
  };

  const availableToAdd = columns.filter(col =>
    !cart.some(item => item.column.id === col.id) &&
    (searchQuery === '' ||
      col.model_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      col.cat_no.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const totalEstimate = cart.reduce((sum, item) => sum + item.quantity * item.column.unit_price, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <ShoppingCart className="w-5 h-5" />
          장바구니 관리
        </h2>
        {isAdmin && (
          <button
            onClick={() => setShowAddModal(true)}
            className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1.5 text-sm"
          >
            <Plus className="w-4 h-4" /> 수동 추가
          </button>
        )}
      </div>

      {message && (
        <div className={`p-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {message.text}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* 자동 장바구니 헤더 */}
        <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-gray-500" />
            <span className="font-medium text-sm">자동 장바구니</span>
            <span className="text-xs text-gray-500">재고 0인 칼럼이 자동으로 추가됩니다</span>
          </div>
          <span className="text-sm font-medium text-gray-700">{cart.length}개 항목</span>
        </div>

        {cart.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <ShoppingCart className="w-10 h-10 mx-auto mb-2 text-gray-300" />
            <p>재고 0개 칼럼이 없습니다</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-600 border-b">
                <tr>
                  {isAdmin && (
                    <th className="px-3 py-2 text-center w-10">
                      <input type="checkbox" checked={allChecked} onChange={toggleAll} className="rounded" />
                    </th>
                  )}
                  <th className="px-3 py-2 text-left">모델명</th>
                  <th className="px-3 py-2 text-left">Cat. No</th>
                  <th className="px-3 py-2 text-left">KEP 코드</th>
                  <th className="px-3 py-2 text-center">구매수량</th>
                  <th className="px-3 py-2 text-right">단가</th>
                  <th className="px-3 py-2 text-right">합계</th>
                  <th className="px-3 py-2 text-center">상태</th>
                  <th className="px-3 py-2 text-left">긴급도</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {cart.map(item => (
                  <tr key={item.column.id} className={`hover:bg-gray-50 ${item.checked ? 'bg-blue-50' : ''}`}>
                    {isAdmin && (
                      <td className="px-3 py-2 text-center">
                        <input type="checkbox" checked={item.checked} onChange={() => toggleItem(item.column.id)} className="rounded" />
                      </td>
                    )}
                    <td className="px-3 py-2 font-medium text-gray-900">{item.column.model_name}</td>
                    <td className="px-3 py-2 font-mono text-xs text-gray-600">{item.column.cat_no}</td>
                    <td className="px-3 py-2 font-mono text-xs text-gray-600">{item.column.kep_code || '-'}</td>
                    <td className="px-3 py-2">
                      {isAdmin ? (
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => updateQty(item.column.id, -1)}
                            className="w-6 h-6 rounded border flex items-center justify-center hover:bg-gray-100 text-xs">－</button>
                          <span className="w-8 text-center font-semibold">{item.quantity}</span>
                          <button onClick={() => updateQty(item.column.id, 1)}
                            className="w-6 h-6 rounded border flex items-center justify-center hover:bg-gray-100 text-xs">＋</button>
                        </div>
                      ) : (
                        <span className="block text-center font-semibold">{item.quantity}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-700">₩{item.column.unit_price.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right font-semibold text-blue-700">
                      ₩{(item.quantity * item.column.unit_price).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
                        재고 {item.column.total_stock}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {isAdmin ? (
                        <select value={item.urgency}
                          onChange={e => setCart(prev => prev.map(i => i.column.id === item.column.id ? { ...i, urgency: e.target.value as any } : i))}
                          className="px-1.5 py-0.5 border rounded text-xs bg-white">
                          {URGENCY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      ) : (
                        <span className="text-xs text-gray-600">
                          {URGENCY_OPTIONS.find(o => o.value === item.urgency)?.label || item.urgency}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 하단 액션 바 */}
        {cart.length > 0 && isAdmin && (
          <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600">{checkedCount}개 항목 선택됨</span>
              <button
                onClick={removeChecked}
                disabled={checkedCount === 0}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-40"
              >
                장바구니 삭제 ({checkedCount})
              </button>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600 font-medium">
                예상 합계: <span className="text-blue-700 font-bold">₩{totalEstimate.toLocaleString()}</span>
              </span>
              <button
                onClick={handleSubmit}
                disabled={submitting || cart.length === 0}
                className="px-4 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5 text-sm font-semibold"
              >
                <Send className="w-4 h-4" />
                {submitting ? '요청 중...' : `발주 완료 (${checkedCount > 0 ? checkedCount : cart.length})`}
              </button>
            </div>
          </div>
        )}
        {/* 읽기 전용 합계 표시 */}
        {cart.length > 0 && !isAdmin && (
          <div className="flex items-center justify-end px-4 py-3 border-t bg-gray-50">
            <span className="text-sm text-gray-600 font-medium">
              예상 합계: <span className="text-blue-700 font-bold">₩{totalEstimate.toLocaleString()}</span>
            </span>
          </div>
        )}
      </div>

      {/* 구매 진행 현황 */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: '요청 대기', value: 0, color: 'text-amber-600' },
          { label: '승인 대기', value: 0, color: 'text-blue-600' },
          { label: '발주 완료', value: 0, color: 'text-green-600' },
        ].map(s => (
          <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-4 text-center">
            <p className="text-xs text-gray-500 mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
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
                  className="w-full text-left p-3 hover:bg-blue-50 rounded-lg flex items-center justify-between group">
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
