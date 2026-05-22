'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  Package, FlaskConical, ShoppingCart, CheckCircle, Activity, Search,
  ClipboardList, Plus, Bell, Calendar, Edit, X,
  History, BarChart2, FileText, Download,
} from 'lucide-react';
import Header from '@/components/Header';
import StatsCard from '@/components/StatsCard';
import ColumnTable from '@/components/ColumnTable';
import MonthlyPurchaseChart from '@/components/charts/MonthlyPurchaseChart';
import BudgetChart from '@/components/charts/BudgetChart';
import IndividualColumnTab from '@/components/IndividualColumnTab';
import ClosingTab from '@/components/ClosingTab';
import CartTab from '@/components/CartTab';
import ClosingDataTab from '@/components/ClosingDataTab';
import PurchaseHistoryTab from '@/components/PurchaseHistoryTab';
import ColumnDetailDialog from '@/components/ColumnDetailDialog';
import PurchaseRequestAddDialog from '@/components/PurchaseRequestAddDialog';
import RequestsPanel from '@/components/RequestsPanel';
import ReceivingsPanel from '@/components/ReceivingsPanel';
import { ColumnModel, DashboardStats, PurchaseRequest, ReceivingRecord, MonthlyClosing } from '@/types';

interface Props {
  adminName: string;
  username: string;
}

type TabType = 'dashboard' | 'cart' | 'requests' | 'receiving' | 'closing_data' | 'purchase_history' | 'columns';

export default function AdminClient({ adminName, username }: Props) {
  const [tab, setTab] = useState<TabType>('dashboard');
  const [columns, setColumns] = useState<ColumnModel[]>([]);
  const [requests, setRequests] = useState<PurchaseRequest[]>([]);
  const [receivings, setReceivings] = useState<ReceivingRecord[]>([]);
  const [closings, setClosings] = useState<MonthlyClosing[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [editingColumn, setEditingColumn] = useState<ColumnModel | null>(null);
  const [detailColumn, setDetailColumn] = useState<ColumnModel | null>(null);
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [chartData, setChartData] = useState<any>(null);

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
  useEffect(() => {
    if (message) {
      const t = setTimeout(() => setMessage(null), 3000);
      return () => clearTimeout(t);
    }
  }, [message]);

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

  const pendingRequests = requests.filter(r => r.status === 'pending');
  const orderedRequests = requests.filter(r => r.status === 'ordered');

  const handleRequestAction = async (id: string, action: 'approve' | 'reject' | 'order' | 'receive', notes?: string) => {
    const res = await fetch(`/api/requests/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, notes }),
    });
    if (!res.ok) {
      const err = await res.json();
      setMessage({ type: 'error', text: err.error });
      return;
    }
    const labels: Record<string, string> = {
      approve: '승인', reject: '거부', order: '발주', receive: '입고'
    };
    setMessage({ type: 'success', text: `${labels[action]} 처리 완료` });
    fetchData();
  };

  const handleColumnDelete = async (col: ColumnModel) => {
    if (!confirm(`"${col.model_name} (${col.cat_no})"을(를) 삭제하시겠습니까?`)) return;
    const res = await fetch(`/api/columns/${col.id}`, { method: 'DELETE' });
    if (!res.ok) {
      setMessage({ type: 'error', text: '삭제 실패' });
      return;
    }
    setMessage({ type: 'success', text: '삭제 완료' });
    fetchData();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header userName={adminName || username} isAdmin />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {message && (
          <div className={`p-3 rounded-lg text-sm ${
            message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>{message.text}</div>
        )}

        {/* 대기 중 요청 알림 */}
        {pendingRequests.length > 0 && tab !== 'requests' && (
          <button
            onClick={() => setTab('requests')}
            className="w-full bg-amber-50 border border-amber-200 rounded-xl p-4 hover:bg-amber-100 transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <Bell className="w-5 h-5 text-amber-600" />
              <div className="flex-1">
                <p className="font-semibold text-amber-900">
                  처리 대기 중인 구매 요청 {pendingRequests.length}건
                </p>
                <p className="text-sm text-amber-800">클릭하여 확인하세요</p>
              </div>
            </div>
          </button>
        )}

        {/* 탭 */}
        <div className="flex gap-1 sm:gap-2 border-b border-gray-200 overflow-x-auto">
          {[
            { key: 'dashboard', label: '대시보드', icon: Package },
            { key: 'requests', label: '구매 요청', icon: ClipboardList, badge: pendingRequests.length },
            { key: 'cart', label: '장바구니', icon: ShoppingCart },
            { key: 'receiving', label: '입고 확인', icon: CheckCircle, badge: orderedRequests.length },
            { key: 'closing_data', label: '마감자료', icon: FileText },
            { key: 'purchase_history', label: '총 구매내역', icon: BarChart2 },
            { key: 'columns', label: '칼럼 이력', icon: History },
          ].map(({ key, label, icon: Icon, badge }) => (
            <button
              key={key}
              onClick={() => setTab(key as TabType)}
              className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                tab === key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
              {badge ? (
                <span className="ml-1 px-1.5 py-0.5 bg-red-100 text-red-700 rounded-full text-xs">
                  {badge}
                </span>
              ) : null}
            </button>
          ))}
        </div>

        {/* 대시보드 */}
        {tab === 'dashboard' && (
          <>
            {stats && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                <StatsCard icon={Package} label="총 칼럼 수" value={stats.totalModels} description="등록 모델" color="blue" />
                <StatsCard icon={FlaskConical} label="총 재고" value={stats.totalStock} description="보유 수량" color="green" />
                <StatsCard icon={ShoppingCart} label="구매 필요" value={stats.purchaseRequiredCount} description="재고 0개" color="red" />
                <StatsCard icon={CheckCircle} label="발주 완료" value={stats.orderCompletedCount} description="진행 중" color="amber" />
                <StatsCard icon={Activity} label="총 자산가치" value={`₩${stats.totalValue.toLocaleString()}원`} description="현재 재고" color="purple" />
              </div>
            )}

            <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="모델명, Cat. No, KEP 코드 검색..."
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
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
              <button
                onClick={() => setShowAddColumn(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1.5 text-sm font-medium whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                칼럼 추가
              </button>
            </div>

            {/* 차트 */}
            {chartData && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <MonthlyPurchaseChart data={chartData.monthlyData || []} />
                {chartData.budgetData && <BudgetChart data={chartData.budgetData} />}
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  칼럼 모델별 재고 현황
                </h2>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">{filteredColumns.length}개</span>
                  <a href="/api/export/inventory" download
                    className="px-2.5 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-1 text-xs">
                    <Download className="w-3.5 h-3.5" /> 엑셀
                  </a>
                </div>
              </div>
              {loading ? (
                <div className="bg-white rounded-xl p-12 text-center text-gray-400">로딩 중...</div>
              ) : (
                <ColumnTable
                  columns={filteredColumns}
                  isAdmin
                  onEdit={setEditingColumn}
                  onDelete={handleColumnDelete}
                  onRowClick={setDetailColumn}
                />
              )}
            </div>
          </>
        )}

        {/* 장바구니 - 탭 이동 시 상태 유지를 위해 항상 마운트 */}
        <div className={tab !== 'cart' ? 'hidden' : ''}>
          <CartTab
            columns={columns}
            approvedRequests={requests.filter(r => r.status === 'approved')}
            adminName={adminName || username}
            onOrderCompleted={fetchData}
          />
        </div>

        {/* 구매 요청 관리 */}
        {tab === 'requests' && (
          <RequestsPanel requests={requests} onAction={handleRequestAction} onRefresh={fetchData} adminName={adminName || username} isAdmin />
        )}

        {/* 입고 확인 */}
        {tab === 'receiving' && (
          <ReceivingsPanel
            orderedRequests={requests.filter(r => r.status === 'ordered')}
            receivings={receivings}
            closings={closings}
            onRefresh={fetchData}
            adminName={adminName || username}
            isAdmin
          />
        )}

        {/* 마감자료 */}
        {tab === 'closing_data' && (
          <ClosingDataTab adminName={adminName || username} />
        )}

        {/* 총 구매내역 */}
        {tab === 'purchase_history' && (
          <PurchaseHistoryTab />
        )}

        {/* 칼럼 이력 */}
        {tab === 'columns' && (
          <IndividualColumnTab columns={columns} />
        )}
      </main>

      {detailColumn && (
        <ColumnDetailDialog
          column={detailColumn}
          onClose={() => setDetailColumn(null)}
          onStockChanged={fetchData}
        />
      )}
      {editingColumn && (
        <ColumnEditDialog
          column={editingColumn}
          onClose={() => setEditingColumn(null)}
          onSaved={() => { setEditingColumn(null); fetchData(); setMessage({ type: 'success', text: '수정되었습니다' }); }}
        />
      )}
      {showAddColumn && (
        <ColumnAddDialog
          onClose={() => setShowAddColumn(false)}
          onSaved={() => { setShowAddColumn(false); fetchData(); setMessage({ type: 'success', text: '칼럼이 추가되었습니다' }); }}
        />
      )}
    </div>
  );
}

// ============================
// 활동 이력 패널
// ============================
function HistoryPanel() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/logs').then(r => r.json()).then(d => {
      setLogs(d.logs || []);
      setLoading(false);
    });
  }, []);

  return (
    <div>
      <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
        <Calendar className="w-5 h-5" />
        활동 이력
      </h2>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-600">
              <tr>
                <th className="px-4 py-3 text-left">시간</th>
                <th className="px-4 py-3 text-left">사용자</th>
                <th className="px-4 py-3 text-left">활동</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={3} className="px-4 py-12 text-center text-gray-400">로딩 중...</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={3} className="px-4 py-12 text-center text-gray-400">활동 내역이 없습니다</td></tr>
              ) : logs.map(log => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-xs text-gray-600">{new Date(log.created_at).toLocaleString('ko-KR')}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      log.actor_type === 'admin' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                    }`}>{log.actor}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{translateAction(log.action)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function translateAction(action: string): string {
  const map: Record<string, string> = {
    login: '로그인',
    admin_login: '관리자 로그인',
    logout: '로그아웃',
    create_column: '칼럼 추가',
    update_column: '칼럼 수정',
    delete_column: '칼럼 삭제',
    create_purchase_request: '구매 요청 생성',
    request_approve: '구매 요청 승인',
    request_reject: '구매 요청 거부',
    request_order: '발주 처리',
    request_receive: '입고 처리',
    delete_request: '요청 삭제',
  };
  return map[action] || action;
}

// ============================
// 칼럼 수정 다이얼로그
// ============================
function ColumnEditDialog({ column, onClose, onSaved }: { column: ColumnModel; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    model_name: column.model_name,
    cat_no: column.cat_no,
    size: column.size || '',
    particle_size: column.particle_size || 0,
    total_stock: column.total_stock,
    min_safety_stock: column.min_safety_stock,
    unit_price: column.unit_price,
    kep_code: column.kep_code || '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const res = await fetch(`/api/columns/${column.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      const err = await res.json();
      setError(err.error || '수정 실패');
      setLoading(false);
      return;
    }
    onSaved();
  };

  return (
    <DialogShell title="칼럼 정보 수정" onClose={onClose}>
      <form onSubmit={handleSave} className="space-y-3">
        <Field label="모델명">
          <input value={form.model_name} onChange={e => setForm({...form, model_name: e.target.value})}
            className="w-full px-3 py-2 border rounded-lg" required />
        </Field>
        <Field label="Cat. No">
          <input value={form.cat_no} onChange={e => setForm({...form, cat_no: e.target.value})}
            className="w-full px-3 py-2 border rounded-lg" required />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="사이즈">
            <input value={form.size} onChange={e => setForm({...form, size: e.target.value})}
              className="w-full px-3 py-2 border rounded-lg" placeholder="4.6mm × 250mm" />
          </Field>
          <Field label="입자크기 (µm)">
            <input type="number" step="0.1" value={form.particle_size}
              onChange={e => setForm({...form, particle_size: parseFloat(e.target.value) || 0})}
              className="w-full px-3 py-2 border rounded-lg" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="재고 수량">
            <input type="number" value={form.total_stock}
              onChange={e => setForm({...form, total_stock: parseInt(e.target.value) || 0})}
              className="w-full px-3 py-2 border rounded-lg" />
          </Field>
          <Field label="최소 안전재고">
            <input type="number" value={form.min_safety_stock}
              onChange={e => setForm({...form, min_safety_stock: parseInt(e.target.value) || 0})}
              className="w-full px-3 py-2 border rounded-lg" />
          </Field>
        </div>
        <Field label="단가 (원)">
          <input type="number" value={form.unit_price}
            onChange={e => setForm({...form, unit_price: parseInt(e.target.value) || 0})}
            className="w-full px-3 py-2 border rounded-lg" />
        </Field>
        <Field label="KEP 코드">
          <input value={form.kep_code} onChange={e => setForm({...form, kep_code: e.target.value})}
            className="w-full px-3 py-2 border rounded-lg" />
        </Field>
        {error && <div className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</div>}
        <div className="flex gap-2 pt-2">
          <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 border rounded-lg">취소</button>
          <button type="submit" disabled={loading} className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {loading ? '저장 중...' : '저장'}
          </button>
        </div>
      </form>
    </DialogShell>
  );
}

// ============================
// 칼럼 추가 다이얼로그
// ============================
function ColumnAddDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    model_name: '',
    cat_no: '',
    size: '',
    particle_size: 5.0,
    total_stock: 0,
    min_safety_stock: 2,
    unit_price: 0,
    kep_code: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const res = await fetch('/api/columns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      const err = await res.json();
      setError(err.error || '추가 실패');
      setLoading(false);
      return;
    }
    onSaved();
  };

  return (
    <DialogShell title="칼럼 추가" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <Field label="모델명 *">
          <input value={form.model_name} onChange={e => setForm({...form, model_name: e.target.value})}
            className="w-full px-3 py-2 border rounded-lg" required placeholder="ZORBAX Eclipse C18" />
        </Field>
        <Field label="Cat. No *">
          <input value={form.cat_no} onChange={e => setForm({...form, cat_no: e.target.value})}
            className="w-full px-3 py-2 border rounded-lg" required placeholder="959963-902" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="사이즈">
            <input value={form.size} onChange={e => setForm({...form, size: e.target.value})}
              className="w-full px-3 py-2 border rounded-lg" placeholder="4.6mm × 250mm" />
          </Field>
          <Field label="입자크기 (µm)">
            <input type="number" step="0.1" value={form.particle_size}
              onChange={e => setForm({...form, particle_size: parseFloat(e.target.value) || 0})}
              className="w-full px-3 py-2 border rounded-lg" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="초기 재고">
            <input type="number" value={form.total_stock}
              onChange={e => setForm({...form, total_stock: parseInt(e.target.value) || 0})}
              className="w-full px-3 py-2 border rounded-lg" />
          </Field>
          <Field label="최소 안전재고">
            <input type="number" value={form.min_safety_stock}
              onChange={e => setForm({...form, min_safety_stock: parseInt(e.target.value) || 2})}
              className="w-full px-3 py-2 border rounded-lg" />
          </Field>
        </div>
        <Field label="단가 (원)">
          <input type="number" value={form.unit_price}
            onChange={e => setForm({...form, unit_price: parseInt(e.target.value) || 0})}
            className="w-full px-3 py-2 border rounded-lg" />
        </Field>
        <Field label="KEP 코드">
          <input value={form.kep_code} onChange={e => setForm({...form, kep_code: e.target.value})}
            className="w-full px-3 py-2 border rounded-lg" placeholder="K012345" />
        </Field>
        {error && <div className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</div>}
        <div className="flex gap-2 pt-2">
          <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 border rounded-lg">취소</button>
          <button type="submit" disabled={loading} className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {loading ? '추가 중...' : '추가'}
          </button>
        </div>
      </form>
    </DialogShell>
  );
}

function DialogShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
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

function UrgencyBadge({ urgency }: { urgency: string }) {
  const map: Record<string, { label: string; className: string }> = {
    low: { label: '낮음', className: 'bg-gray-100 text-gray-700' },
    normal: { label: '보통', className: 'bg-blue-50 text-blue-700' },
    high: { label: '높음', className: 'bg-orange-100 text-orange-800' },
    urgent: { label: '긴급', className: 'bg-red-100 text-red-800' },
  };
  const m = map[urgency] || { label: urgency, className: 'bg-gray-100 text-gray-700' };
  return <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${m.className}`}>{m.label}</span>;
}
