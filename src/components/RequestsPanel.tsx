'use client';

import { useState } from 'react';
import { Download, Plus, ShoppingCart, Trash2 } from 'lucide-react';
import PurchaseRequestAddDialog from '@/components/PurchaseRequestAddDialog';
import { PurchaseRequest } from '@/types';

interface Props {
  requests: PurchaseRequest[];
  onAction: (id: string, action: 'approve' | 'reject' | 'order' | 'receive', notes?: string) => Promise<void>;
  onRefresh: () => void;
  adminName?: string;
  isAdmin?: boolean;
}

export default function RequestsPanel({
  requests, onAction, onRefresh, adminName, isAdmin = true,
}: Props) {
  const [showAdd, setShowAdd] = useState(false);

  const active = requests.filter(r => !['received', 'rejected'].includes(r.status));
  const completed = requests.filter(r => r.status === 'received');
  const rejected = requests.filter(r => r.status === 'rejected');

  const handleDelete = async (id: string) => {
    if (!confirm('이 구매 요청을 삭제하시겠습니까?')) return;
    const res = await fetch(`/api/requests/${id}`, { method: 'DELETE' });
    if (res.ok) onRefresh();
  };

  const RequestTable = ({ rows, showActions }: { rows: PurchaseRequest[]; showActions?: boolean }) => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-600">
            <tr>
              <th className="px-4 py-3 text-left">요청일</th>
              <th className="px-4 py-3 text-left">요청자</th>
              <th className="px-4 py-3 text-left">모델명</th>
              <th className="px-4 py-3 text-left">Cat. No</th>
              <th className="px-4 py-3 text-center">수량</th>
              <th className="px-4 py-3 text-left">요청사유</th>
              <th className="px-4 py-3 text-center">상태</th>
              {(isAdmin || showActions) && <th className="px-4 py-3 text-center">처리</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 ? (
              <tr><td colSpan={isAdmin ? 8 : 7} className="px-4 py-10 text-center text-gray-400">내역이 없습니다</td></tr>
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
                <td className="px-4 py-3 text-center"><StatusBadge status={req.status} /></td>
                {isAdmin && (
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1.5 flex-wrap">
                      {showActions && (
                        <>
                          {req.status === 'pending' && (
                            <>
                              <button onClick={() => onAction(req.id, 'approve')}
                                className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700">승인</button>
                              <button onClick={() => onAction(req.id, 'reject')}
                                className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700">거부</button>
                            </>
                          )}
                          {req.status === 'approved' && (
                            <button onClick={() => onAction(req.id, 'order')}
                              className="px-2 py-1 bg-purple-600 text-white text-xs rounded hover:bg-purple-700">발주</button>
                          )}
                          {req.status === 'ordered' && (
                            <button onClick={() => onAction(req.id, 'receive')}
                              className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700">입고처리</button>
                          )}
                        </>
                      )}
                      <button onClick={() => handleDelete(req.id)}
                        className="p-1 hover:bg-red-50 rounded text-red-400 hover:text-red-600">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
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

      {/* 구매 진행 중 */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
          구매요청 목록 ({active.length})
        </h3>
        <RequestTable rows={active} showActions={isAdmin} />
      </div>

      {/* 구매완료 */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
          구매완료 목록 ({completed.length})
        </h3>
        <RequestTable rows={completed} />
      </div>

      {/* 거부됨 */}
      {rejected.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-500 mb-2 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />
            거부됨 ({rejected.length})
          </h3>
          <RequestTable rows={rejected} />
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
