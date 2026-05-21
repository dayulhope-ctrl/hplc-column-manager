'use client';

import { useEffect, useState, useMemo } from 'react';
import { Package, FlaskConical, ShoppingCart, CheckCircle, Activity, Search, ClipboardList, Plus } from 'lucide-react';
import Header from '@/components/Header';
import StatsCard from '@/components/StatsCard';
import ColumnTable from '@/components/ColumnTable';
import PurchaseRequestDialog from '@/components/PurchaseRequestDialog';
import PurchaseRequestAddDialog from '@/components/PurchaseRequestAddDialog';
import { ColumnModel, DashboardStats, PurchaseRequest } from '@/types';

interface Props {
  userName: string;
  isAdmin: boolean;
}

type TabType = 'dashboard' | 'requests';

export default function DashboardClient({ userName, isAdmin }: Props) {
  const [tab, setTab] = useState<TabType>('dashboard');
  const [columns, setColumns] = useState<ColumnModel[]>([]);
  const [requests, setRequests] = useState<PurchaseRequest[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [selectedColumn, setSelectedColumn] = useState<ColumnModel | null>(null);
  const [showAddRequest, setShowAddRequest] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [colRes, statsRes, reqRes] = await Promise.all([
        fetch('/api/columns'),
        fetch('/api/stats'),
        fetch('/api/requests'),
      ]);
      const colData = await colRes.json();
      const statsData = await statsRes.json();
      const reqData = await reqRes.json();
      setColumns(colData.columns || []);
      setStats(statsData.stats);
      setRequests(reqData.requests || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // 메시지 자동 사라짐
  useEffect(() => {
    if (message) {
      const t = setTimeout(() => setMessage(null), 3000);
      return () => clearTimeout(t);
    }
  }, [message]);

  // 필터된 칼럼
  const filteredColumns = useMemo(() => {
    let result = columns;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(c =>
        c.model_name.toLowerCase().includes(q) ||
        c.cat_no.toLowerCase().includes(q) ||
        (c.kep_code?.toLowerCase().includes(q))
      );
    }
    if (filter === 'low_stock') result = result.filter(c => c.total_stock <= c.min_safety_stock);
    if (filter === 'out_of_stock') result = result.filter(c => c.total_stock === 0);
    if (filter === 'ordered') result = result.filter(c => c.purchase_status === '발주 완료');
    return result;
  }, [columns, search, filter]);

  const handlePurchaseRequest = async (data: { quantity: number; reason: string; urgency: string }) => {
    if (!selectedColumn) return;
    const res = await fetch('/api/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        column_model_id: selectedColumn.id,
        ...data,
      }),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error);
    setSelectedColumn(null);
    setMessage({ type: 'success', text: '구매 요청이 제출되었습니다' });
    fetchData();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header userName={userName} isAdmin={isAdmin} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* 메시지 */}
        {message && (
          <div className={`p-3 rounded-lg text-sm ${
            message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            {message.text}
          </div>
        )}

        {/* 탭 */}
        <div className="flex items-center justify-between border-b border-gray-200">
          <div className="flex gap-2">
            <button
              onClick={() => setTab('dashboard')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                tab === 'dashboard'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <Package className="w-4 h-4 inline mr-1.5" />
              대시보드
            </button>
            <button
              onClick={() => setTab('requests')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                tab === 'requests'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <ClipboardList className="w-4 h-4 inline mr-1.5" />
              구매요청 내역
              {requests.filter(r => r.status === 'pending').length > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs">
                  {requests.filter(r => r.status === 'pending').length}
                </span>
              )}
            </button>
          </div>
          <button
            onClick={() => setShowAddRequest(true)}
            className="mb-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1.5 text-sm font-medium"
          >
            <Plus className="w-4 h-4" /> 구매요청 추가
          </button>
        </div>

        {/* 대시보드 탭 */}
        {tab === 'dashboard' && (
          <>
            {/* 통계 카드 */}
            {stats && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                <StatsCard icon={Package} label="총 칼럼 수" value={stats.totalModels} description="등록 모델" color="blue" />
                <StatsCard icon={FlaskConical} label="총 재고" value={stats.totalStock} description="보유 수량" color="green" />
                <StatsCard icon={ShoppingCart} label="구매 필요" value={stats.purchaseRequiredCount} description="재고 0개" color="red" />
                <StatsCard icon={CheckCircle} label="발주 완료" value={stats.orderCompletedCount} description="진행 중" color="amber" />
                <StatsCard icon={Activity} label="총 자산가치" value={`₩${stats.totalValue.toLocaleString()}원`} description="현재 재고" color="purple" />
              </div>
            )}

            {/* 검색 & 필터 */}
            <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="모델명, Cat. No, KEP 코드 검색..."
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm bg-white"
              >
                <option value="all">전체</option>
                <option value="low_stock">재고 부족</option>
                <option value="out_of_stock">품절</option>
                <option value="ordered">발주 완료</option>
              </select>
            </div>

            {/* 칼럼 테이블 */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  칼럼 모델별 재고 현황
                </h2>
                <span className="text-sm text-gray-500">{filteredColumns.length}개</span>
              </div>
              {loading ? (
                <div className="bg-white rounded-xl p-12 text-center text-gray-400">로딩 중...</div>
              ) : (
                <ColumnTable
                  columns={filteredColumns}
                  onRequestPurchase={setSelectedColumn}
                />
              )}
            </div>
          </>
        )}

        {/* 요청 내역 탭 */}
        {tab === 'requests' && (
          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
              <ClipboardList className="w-5 h-5" />
              전체 구매 요청 내역
            </h2>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
                    <tr>
                      <th className="px-4 py-3 text-left">요청일</th>
                      <th className="px-4 py-3 text-left">요청자</th>
                      <th className="px-4 py-3 text-left">모델명</th>
                      <th className="px-4 py-3 text-left">Cat. No</th>
                      <th className="px-4 py-3 text-center">수량</th>
                      <th className="px-4 py-3 text-left">요청사유</th>
                      <th className="px-4 py-3 text-center">상태</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {requests.length === 0 ? (
                      <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400">구매 요청 내역이 없습니다</td></tr>
                    ) : requests.map(req => (
                      <tr key={req.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-600 text-xs">
                          {new Date(req.created_at).toLocaleDateString('ko-KR')}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900 text-xs">{req.requested_by}</div>
                          {req.department && <div className="text-xs text-gray-400">{req.department}</div>}
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-900 text-sm">{req.column_models?.model_name}</td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-500">{req.column_models?.cat_no}</td>
                        <td className="px-4 py-3 text-center font-semibold">{req.quantity}</td>
                        <td className="px-4 py-3 text-xs text-gray-600">{req.reason || '-'}</td>
                        <td className="px-4 py-3 text-center">
                          <StatusBadge status={req.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* 칼럼 선택 구매 요청 다이얼로그 */}
      {selectedColumn && (
        <PurchaseRequestDialog
          column={selectedColumn}
          onClose={() => setSelectedColumn(null)}
          onSubmit={handlePurchaseRequest}
        />
      )}

      {/* 자유형식 구매요청 추가 다이얼로그 */}
      {showAddRequest && (
        <PurchaseRequestAddDialog
          defaultRequester={userName}
          onClose={() => setShowAddRequest(false)}
          onSaved={() => {
            setShowAddRequest(false);
            setMessage({ type: 'success', text: '구매요청이 추가되었습니다' });
            fetchData();
          }}
        />
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    pending: { label: '대기중', className: 'bg-amber-100 text-amber-800' },
    approved: { label: '승인됨', className: 'bg-blue-100 text-blue-800' },
    rejected: { label: '거부됨', className: 'bg-red-100 text-red-800' },
    ordered: { label: '발주 완료', className: 'bg-purple-100 text-purple-800' },
    received: { label: '입고 완료', className: 'bg-green-100 text-green-800' },
  };
  const m = map[status] || { label: status, className: 'bg-gray-100 text-gray-700' };
  return <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${m.className}`}>{m.label}</span>;
}
