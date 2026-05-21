'use client';

import { useState } from 'react';
import { CheckCircle, Download, Trash2 } from 'lucide-react';
import { ReceivingRecord, MonthlyClosing } from '@/types';

interface Props {
  receivings: ReceivingRecord[];
  closings: MonthlyClosing[];
  onRefresh: () => void;
  isAdmin?: boolean;
}

export default function ReceivingsPanel({ receivings, closings, onRefresh, isAdmin = true }: Props) {
  const [showAll, setShowAll] = useState(false);

  const closedMonths = new Set(closings.map(c => c.month));
  const unclosed = receivings.filter(r => !closedMonths.has(r.receiving_date.slice(0, 7)));
  const display = showAll ? receivings : unclosed;

  const handleDelete = async (id: string) => {
    if (!confirm('이 입고 기록을 삭제하시겠습니까?')) return;
    const res = await fetch(`/api/receivings/${id}`, { method: 'DELETE' });
    if (res.ok) onRefresh();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <CheckCircle className="w-5 h-5" />
          입고 확인
          <span className="text-sm font-normal text-gray-500">
            {showAll ? `전체 ${receivings.length}건` : `미마감 ${unclosed.length}건`}
          </span>
        </h2>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={showAll}
              onChange={e => setShowAll(e.target.checked)}
              className="rounded"
            />
            마감 완료 항목 포함
          </label>
          {isAdmin && (
            <a href="/api/export/receivings" download
              className="px-2.5 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-1 text-xs">
              <Download className="w-3.5 h-3.5" /> 엑셀
            </a>
          )}
        </div>
      </div>

      {!showAll && unclosed.length === 0 && receivings.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-3 text-sm text-green-800">
          모든 입고 기록이 마감 처리되었습니다. "마감 완료 항목 포함"을 체크하면 전체 내역을 볼 수 있습니다.
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-600">
              <tr>
                <th className="px-4 py-3 text-left">입고일</th>
                <th className="px-4 py-3 text-left">모델명</th>
                <th className="px-4 py-3 text-left">Cat. No</th>
                <th className="px-4 py-3 text-center">수량</th>
                <th className="px-4 py-3 text-right">단가</th>
                <th className="px-4 py-3 text-right">총액</th>
                <th className="px-4 py-3 text-left">처리자</th>
                <th className="px-4 py-3 text-center">마감</th>
                {isAdmin && <th className="px-4 py-3 text-center">삭제</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {display.length === 0 ? (
                <tr><td colSpan={isAdmin ? 9 : 8} className="px-4 py-12 text-center text-gray-400">입고 내역이 없습니다</td></tr>
              ) : display.map(rec => {
                const isClosed = closedMonths.has(rec.receiving_date.slice(0, 7));
                return (
                  <tr key={rec.id} className={`hover:bg-gray-50 ${isClosed ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3 text-xs">{rec.receiving_date}</td>
                    <td className="px-4 py-3 font-medium">{rec.model_name}</td>
                    <td className="px-4 py-3 font-mono text-xs">{rec.cat_no}</td>
                    <td className="px-4 py-3 text-center font-semibold">{rec.quantity}</td>
                    <td className="px-4 py-3 text-right">₩{rec.unit_price?.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-semibold">₩{rec.total_price?.toLocaleString()}</td>
                    <td className="px-4 py-3 text-xs text-gray-600">{rec.received_by}</td>
                    <td className="px-4 py-3 text-center">
                      {isClosed
                        ? <span className="text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded-full">마감됨</span>
                        : <span className="text-xs text-gray-400">-</span>
                      }
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => handleDelete(rec.id)}
                          className="p-1 hover:bg-red-50 rounded text-red-400 hover:text-red-600">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
