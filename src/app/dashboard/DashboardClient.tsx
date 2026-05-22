'use client';

import { useEffect, useState, useMemo } from 'react';
import { Package, FlaskConical, ShoppingCart, CheckCircle, Activity, Search, ClipboardList, Plus, History, BarChart2, FileText } from 'lucide-react';
import Header from '@/components/Header';
import StatsCard from '@/components/StatsCard';
import ColumnTable from '@/components/ColumnTable';
import PurchaseRequestDialog from '@/components/PurchaseRequestDialog';
import PurchaseRequestAddDialog from '@/components/PurchaseRequestAddDialog';
import MonthlyPurchaseChart from '@/components/charts/MonthlyPurchaseChart';
import BudgetChart from '@/components/charts/BudgetChart';
import CartTab from '@/components/CartTab';
import ClosingDataTab from '@/components/ClosingDataTab';
import PurchaseHistoryTab from '@/components/PurchaseHistoryTab';
import IndividualColumnTab from '@/components/IndividualColumnTab';
import ColumnDetailDialog from '@/components/ColumnDetailDialog';
import RequestsPanel from '@/components/RequestsPanel';
import ReceivingsPanel from '@/components/ReceivingsPanel';
import { ColumnModel, DashboardStats, PurchaseRequest, ReceivingRecord, MonthlyClosing } from '@/types';

interface Props {
  userName: string | null;
  isAdmin: boolean;
}

type TabType = 'dashboard' | 'requests' | 'cart' | 'receiving' | 'closing_data' | 'purchase_history' | 'columns';

export default function DashboardClient({ userName: initialUserName, isAdmin }: Props) {
  // 게스트 이름: localStorage에서 복원 또는 null
  const [guestName, setGuestName] = useState<string | null>(null);
  const [showNameModal, setShowNameModal] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  // localStorage에서 저장된 이름 복원
  useEffect(() => {
    if (!initialUserName && !isAdmin) {
      const saved = localStorage.getItem('hplc_guest_name');
      if (saved) setGuestName(saved);
    }
  }, [initialUserName, isAdmin]);

  const userName = initialUserName ?? guestName;

  // 이름이 필요한 액션 실행 전 확인
  const requireName = (action: () => void) => {
    if (userName) {
      action();
    } else {
      setPendingAction(() => action);
      setShowNameModal(true);
    }
  };

  const handleNameSubmit = () => {
    const name = nameInput.trim();
    if (!name) return;
    localStorage.setItem('hplc_guest_name', name);
    setGuestName(name);
    setShowNameModal(false);
    setNameInput('');
    if (pendingAction) {
      pendingAction();
      setPendingAction(null);
    }
  };
  const [tab, setTab] = useState<TabType>('dashboard');
  const [columns, setColumns] = useState<ColumnModel[]>([]);
  const [requests, setRequests] = useState<PurchaseRequest[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [receivings, setReceivings] = useState<ReceivingRecord[]>([]);
  const [closings, setClosings] = useState<MonthlyClosing[]>([]);
  const [chartData, setChartData] = useState<any>(null);
  const [detailColumn, setDetailColumn] = useState<ColumnModel | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [selectedColumn, setSelectedColumn] = useState<ColumnModel | null>(null);
  const [showAddRequest, setShowAddRequest] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [colRes, statsRes, reqRes, recRes, chartRes, closingRes] = await Promise.all([
        fetch('/api/columns'),
        fetch('/api/stats'),
        fetch('/api/requests'),
        fetch('/api/receivings'),
        fetch('/api/stats/charts'),
        fetch('/api/closings'),
      ]);
      setColumns((await colRes.json()).columns || []);
      setStats((await statsRes.json()).stats);
      setRequests((await reqRes.json()).requests || []);
      setReceivings((await recRes.json()).records || []);
      const cd = await chartRes.json();
      setChartData(cd);
      setClosings((await closingRes.json()).closings || []);
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
        requester_name: userName ?? '익명',
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

      {/* 이름 입력 모달 (게스트용) */}
      {showNameModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <h2 className="text-lg font-bold text-gray-900 mb-1">이름을 알려주세요</h2>
            <p className="text-sm text-gray-500 mb-4">구매 신청에 이름이 필요합니다. 한 번 입력하면 다음부터 자동으로 기억됩니다.</p>
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleNameSubmit()}
              placeholder="홍길동"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={() => { setShowNameModal(false); setPendingAction(null); }}
                className="flex-1 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleNameSubmit}
                disabled={!nameInput.trim()}
                className="flex-1 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}

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
        <div className="flex gap-1 sm:gap-2 border-b border-gray-200 overflow-x-auto">
          {[
            { key: 'dashboard', label: '대시보드', icon: Package },
            { key: 'requests', label: '구매요청 내역', icon: ClipboardList },
            { key: 'cart', label: '장바구니', icon: ShoppingCart },
            { key: 'receiving', label: '입고 확인', icon: CheckCircle },
            { key: 'closing_data', label: '마감자료', icon: FileText },
            { key: 'purchase_history', label: '총 구매내역', icon: BarChart2 },
            { key: 'columns', label: '칼럼 이력', icon: History },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key as TabType)}
              className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                tab === key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
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

            {/* 차트 */}
            {chartData && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <MonthlyPurchaseChart data={chartData.monthlyData || []} />
                {chartData.budgetData && <BudgetChart data={chartData.budgetData} />}
              </div>
            )}

            {/* 칼럼 테이블 */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  칼럼 모델별 재고 현황
                </h2>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">{filteredColumns.length}개</span>
                  <button
                    onClick={() => setShowAddRequest(true)}
                    className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1.5 text-sm font-medium"
                  >
                    <Plus className="w-4 h-4" /> 구매요청 추가
                  </button>
                </div>
              </div>
              {loading ? (
                <div className="bg-white rounded-xl p-12 text-center text-gray-400">로딩 중...</div>
              ) : (
                <ColumnTable
                  columns={filteredColumns}
                  onRequestPurchase={(col) => requireName(() => setSelectedColumn(col))}
                  onRowClick={setDetailColumn}
                />
              )}
            </div>
          </>
        )}

        {/* 구매요청 내역 탭 */}
        {tab === 'requests' && (
          <RequestsPanel
            requests={requests}
            onAction={async () => {}}
            onRefresh={fetchData}
            adminName={userName ?? undefined}
            isAdmin={false}
          />
        )}

        {/* 장바구니 탭 */}
        <div className={tab !== 'cart' ? 'hidden' : ''}>
          <CartTab
            columns={columns}
            approvedRequests={requests.filter(r => r.status === 'approved')}
            isAdmin={false}
            onOrderCompleted={fetchData}
          />
        </div>

        {/* 입고 확인 탭 */}
        {tab === 'receiving' && (
          <ReceivingsPanel
            orderedRequests={requests.filter(r => r.status === 'ordered')}
            receivings={receivings}
            closings={closings}
            onRefresh={fetchData}
            isAdmin={false}
          />
        )}

        {/* 마감자료 탭 */}
        {tab === 'closing_data' && (
          <ClosingDataTab adminName={userName ?? undefined} isAdmin={false} />
        )}

        {/* 총 구매내역 탭 */}
        {tab === 'purchase_history' && (
          <PurchaseHistoryTab isAdmin={false} />
        )}

        {/* 칼럼 이력 탭 */}
        {tab === 'columns' && (
          <IndividualColumnTab columns={columns} isAdmin={false} />
        )}
      </main>

      {/* 칼럼 상세 다이얼로그 (읽기 전용) */}
      {detailColumn && (
        <ColumnDetailDialog
          column={detailColumn}
          onClose={() => setDetailColumn(null)}
          isAdmin={false}
        />
      )}

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
          defaultRequester={userName ?? undefined}
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
