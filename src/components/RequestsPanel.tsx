'use client';

import { useState } from 'react';
import { Download, Plus, ShoppingCart, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import PurchaseRequestAddDialog from '@/components/PurchaseRequestAddDialog';
import { PurchaseRequest } from '@/types';

interface Props {
  requests: PurchaseRequest[];
  onAction: (id: string, action: 'approve' | 'reject' | 'order' | 'receive', notes?: string) => Promise<void>;
  onRefresh: () => void;
  adminName?: string;
  isAdmin?: boolean;
}

// ── 상태별 표시 정의 ──
const STATUS_MAP: Record<string, { label: string; className: string; dot: string }> = {
  pending:  { label: '승인 대기', className: 'bg-amber-100 text-amber-800',   dot: 'bg-amber-400' },
  approved: { label: '구매 대기', className: 'bg-blue-100 text-blue-800',     dot: 'bg-blue-400' },
  ordered:  { label: '결제 완료', className: 'bg-purple-100 text-purple-800', dot: 'bg-purple-500' },
  received: { label: '입고 완료', className: 'bg-green-100 text-green-800',   dot: 'bg-green-500' },
  rejected: { label: '거부됨',   className: 'bg-red-100 text-red-700',        dot: 'bg-red-400' },
};

function StatusBadge({ status }: { status: string }) {
  const m = STATUS_MAP[status] ?? { label: status, className: 'bg-gray-100 text-gray-700', dot: 'bg-gray-400' };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${m.className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  );
}

export default function RequestsPanel({
  requests, onAction, onRefresh, adminName, isAdmin = true,
}: Props) {
  const [showAdd, setShowAdd] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [showRejected, setShowRejected] = useState(false);

  const pending  = requests.filter(r => r.status === 'pending');
  const inProgress = requests.filter(r => ['approved', 'ordered'].includes(r.status));
  const completed = requests.filter(r => r.status === 'received');
  const rejected  = requests.filter(r => r.status === 'rejected');

  const handleDelete = async (id: string) => {
    if (!confirm('이 구매 요청을 삭제하시겠습니까?')) return;
    const res = await fetch(`/api/requests/${id}`, { method: 'DELETE' });
    if (res.ok) onRefresh();
  };

  const cols = isAdmin
    ? ['요청일', '요청자', '모델명', 'CAT. NO', '수량', '요청사유', '상태', '처리']
    : ['요청일', '요청자', '모델명', 'CAT. NO', '수량', '요청사유', '상태'];

  const RequestTable = ({
    rows,
    showApproveBtn = false,
    showDeleteBtn = true,
  }: {
    rows: PurchaseRequest[];
    showApproveBtn?: boolean;
    showDeleteBtn?: boolean;
  }) => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-600">
            <tr>
              <th className="px-4 py-3 text-left">요청일</th>
              <th className="px-4 py-3 text-left">요청자</th>
              <th className="px-4 py-3 text-left">모델명</th>
              <th className="px-4 py-3 text-left">Cat. NO</th>
              <th className="px-4 py-3 text-center">수량</th>
              <th className="px-4 py-3 text-left">요청사유</th>
              <th className="px-4 py-3 text-center">상태</th>
              {isAdmin && <th className="px-4 py-3 text-center">처리</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={isAdmin ? 8 : 7} className="px-4 py-10 text-center text-gray-400">
                  내역이 없습니다
                </td>
              </tr>
            ) : rows.map(req => (
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
                {isAdmin && (
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1.5 flex-wrap">
                      {showApproveBtn && req.status === 'pending' && (
                        <>
                          <button
                            onClick={() => onAction(req.id, 'approve')}
                            className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                          >승인</button>
                          <button
                            onClick={() => onAction(req.id, 'reject')}
                            className="px-2 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600"
                          >거부</button>
                        </>
                      )}
                      {showDeleteBtn && (
                        <button
                          onClick={() => handleDelete(req.id)}
                          className="p-1 hover:bg-red-50 rounded text-red-400 hover:text-red-600"
                          title="삭제"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <ShoppingCart className="w-5 h-5" />
          구매 요청 {isAdmin ? '관리' : '내역'}
        </h2>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <a href="/api/export/requests" download
              className="px-2.5 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-1 text-xs">
              <Download className="w-3.5 h-3.5" /> 엑셀
            </a>
          )}
          <button
            onClick={() => setShowAdd(true)}
            className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1.5 text-sm font-medium"
          >
            <Plus className="w-4 h-4" /> 구매요청 추가
          </button>
        </div>
      </div>

      {/* ── 섹션 1: 승인 대기 ── */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
          승인 대기
          <span className="text-xs font-normal text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">{pending.length}건</span>
        </h3>
        <RequestTable rows={pending} showApproveBtn={true} />
      </div>

      {/* ── 섹션 2: 진행 중 (구매대기 + 결제완료) ── */}
      {inProgress.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />
            진행 중
            <span className="text-xs font-normal text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">{inProgress.length}건</span>
            <span className="text-xs text-gray-400 ml-1">— 장바구니 대기 또는 결제 완료된 항목</span>
          </h3>
          <RequestTable rows={inProgress} showApproveBtn={false} showDeleteBtn={isAdmin} />
        </div>
      )}

      {/* ── 섹션 3: 입고 완료 (토글) ── */}
      {completed.length > 0 && (
        <div>
          <button
            onClick={() => setShowCompleted(v => !v)}
            className="flex items-center gap-1.5 text-sm font-semibold text-gray-600 mb-2 hover:text-gray-900 transition-colors"
          >
            <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
            입고 완료
            <span className="text-xs font-normal text-green-700 bg-green-50 px-2 py-0.5 rounded-full">{completed.length}건</span>
            {showCompleted ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          {showCompleted && (
            <RequestTable rows={completed} showApproveBtn={false} showDeleteBtn={false} />
          )}
        </div>
      )}

      {/* ── 섹션 4: 거부됨 (토글) ── */}
      {rejected.length > 0 && (
        <div>
          <button
            onClick={() => setShowRejected(v => !v)}
            className="flex items-center gap-1.5 text-sm font-semibold text-gray-500 mb-2 hover:text-gray-700 transition-colors"
          >
            <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />
            거부됨
            <span className="text-xs font-normal text-red-600 bg-red-50 px-2 py-0.5 rounded-full">{rejected.length}건</span>
            {showRejected ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          {showRejected && (
            <RequestTable rows={rejected} showApproveBtn={false} showDeleteBtn={isAdmin} />
          )}
        </div>
      )}

      {showAdd && (
        <PurchaseRequestAddDialog
          defaultRequester={adminName}
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); onRefresh(); }}
        />
      )}
    </div>
  );
}
