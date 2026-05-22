'use client';

import { useState } from 'react';
import { CheckCircle, Download, Truck } from 'lucide-react';
import { PurchaseRequest, ReceivingRecord, MonthlyClosing } from '@/types';

interface ReceiveModalData {
  request: PurchaseRequest;
  unitPrice: number;
  receivingDate: string;
}

interface Props {
  orderedRequests: PurchaseRequest[];   // 발주 완료 → 입고 대기 중
  receivings: ReceivingRecord[];        // 이미 입고 완료된 기록 (마감자료 탭과 연동)
  closings: MonthlyClosing[];
  onRefresh: () => void;
  adminName?: string;
  isAdmin?: boolean;
}

export default function ReceivingsPanel({
  orderedRequests, receivings, closings, onRefresh, adminName, isAdmin = true,
}: Props) {
  const [receiveModal, setReceiveModal] = useState<ReceiveModalData | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // 입고확인 버튼 클릭 → 모달 열기
  const openReceiveModal = (req: PurchaseRequest) => {
    setReceiveModal({
      request: req,
      unitPrice: req.column_models?.unit_price ?? 0,
      receivingDate: new Date().toISOString().split('T')[0],
    });
  };

  // 입고 처리 실행
  const handleConfirmReceive = async () => {
    if (!receiveModal) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/requests/${receiveModal.request.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'receive',
          unit_price: receiveModal.unitPrice,
          receiving_date: receiveModal.receivingDate,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setMessage({ type: 'success', text: '입고 처리 완료되었습니다' });
      setReceiveModal(null);
      onRefresh();
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message || '입고 처리 실패' });
    } finally {
      setSubmitting(false);
    }
  };

  // 마감 상태
  const closedMonths = new Set(closings.map(c => c.month));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <CheckCircle className="w-5 h-5" />
          입고 확인
        </h2>
        {isAdmin && (
          <a href="/api/export/receivings" download
            className="px-2.5 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-1 text-xs">
            <Download className="w-3.5 h-3.5" /> 엑셀
          </a>
        )}
      </div>

      {message && (
        <div className={`p-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {message.text}
        </div>
      )}

      {/* ── 발주 완료 → 입고 대기 ── */}
      <div className="bg-white rounded-xl border border-orange-200 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 bg-orange-50 border-b border-orange-100">
          <Truck className="w-4 h-4 text-orange-600" />
          <span className="font-semibold text-sm text-orange-900">입고 대기 중</span>
          <span className="text-xs text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full">{orderedRequests.length}건</span>
          <span className="text-xs text-gray-500 ml-1">— 물건이 도착하면 입고확인을 클릭하세요</span>
          {isAdmin && orderedRequests.length > 0 && (
            <a href="/api/export/ordered" download
              className="ml-auto px-2.5 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-1 text-xs">
              <Download className="w-3.5 h-3.5" /> 엑셀
            </a>
          )}
        </div>

        {orderedRequests.length === 0 ? (
          <div className="p-10 text-center text-gray-400 text-sm">
            <Truck className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            입고 대기 중인 항목이 없습니다
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-600 border-b">
                <tr>
                  <th className="px-4 py-2 text-left">발주일</th>
                  <th className="px-4 py-2 text-left">요청자</th>
                  <th className="px-4 py-2 text-left">모델명</th>
                  <th className="px-4 py-2 text-left">Cat. No</th>
                  <th className="px-4 py-2 text-center">수량</th>
                  <th className="px-4 py-2 text-right">단가</th>
                  <th className="px-4 py-2 text-right">예상 총액</th>
                  {isAdmin && <th className="px-4 py-2 text-center">처리</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {orderedRequests.map(req => (
                  <tr key={req.id} className="hover:bg-orange-50/40">
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {req.ordered_at ? new Date(req.ordered_at).toLocaleDateString('ko-KR') : '-'}
                    </td>
                    <td className="px-4 py-3 text-xs font-medium">{req.requested_by}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{req.column_models?.model_name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{req.column_models?.cat_no}</td>
                    <td className="px-4 py-3 text-center font-semibold">{req.quantity}</td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      ₩{(req.column_models?.unit_price ?? 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-blue-700">
                      ₩{((req.column_models?.unit_price ?? 0) * req.quantity).toLocaleString()}
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => openReceiveModal(req)}
                          className="px-3 py-1 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 flex items-center gap-1 mx-auto"
                        >
                          <CheckCircle className="w-3 h-3" />
                          입고확인
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

      {/* ── 입고 완료 기록 (참고용) ── */}
      {receivings.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-600 mb-2 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
            입고 완료 기록 ({receivings.length}건)
          </h3>
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 border-b">
                  <tr>
                    <th className="px-4 py-2 text-left">입고일</th>
                    <th className="px-4 py-2 text-left">모델명</th>
                    <th className="px-4 py-2 text-left">Cat. No</th>
                    <th className="px-4 py-2 text-center">수량</th>
                    <th className="px-4 py-2 text-right">총액</th>
                    <th className="px-4 py-2 text-center">마감</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {receivings.slice(0, 10).map(rec => {
                    const isClosed = closedMonths.has(rec.receiving_date?.slice(0, 7) ?? '');
                    return (
                      <tr key={rec.id} className={`hover:bg-gray-50 ${isClosed ? 'opacity-50' : ''}`}>
                        <td className="px-4 py-2 text-xs">{rec.receiving_date}</td>
                        <td className="px-4 py-2 font-medium text-sm">{rec.model_name}</td>
                        <td className="px-4 py-2 font-mono text-xs text-gray-500">{rec.cat_no}</td>
                        <td className="px-4 py-2 text-center font-semibold">{rec.quantity}</td>
                        <td className="px-4 py-2 text-right text-sm">₩{rec.total_price?.toLocaleString()}</td>
                        <td className="px-4 py-2 text-center">
                          {isClosed
                            ? <span className="text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded-full">마감됨</span>
                            : <span className="text-xs text-gray-400">-</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {receivings.length > 10 && (
              <div className="px-4 py-2 text-xs text-gray-400 border-t">
                전체 {receivings.length}건 중 최근 10건 표시 — 상세 내역은 마감자료 탭 참조
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── 입고확인 모달 ── */}
      {receiveModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <h2 className="text-lg font-bold text-gray-900 mb-1 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              입고 확인
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              <span className="font-semibold text-gray-800">{receiveModal.request.column_models?.model_name}</span> 입고 처리
            </p>
            <div className="space-y-3 mb-5">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">입고일</label>
                <input
                  type="date"
                  value={receiveModal.receivingDate}
                  onChange={e => setReceiveModal(p => p ? { ...p, receivingDate: e.target.value } : null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">단가 (원)</label>
                <input
                  type="number"
                  value={receiveModal.unitPrice}
                  onChange={e => setReceiveModal(p => p ? { ...p, unitPrice: Number(e.target.value) } : null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div className="bg-gray-50 rounded-lg px-3 py-2 text-sm">
                <span className="text-gray-500">수량:</span> <span className="font-semibold">{receiveModal.request.quantity}개</span>
                <span className="mx-2 text-gray-300">|</span>
                <span className="text-gray-500">총액:</span>{' '}
                <span className="font-semibold text-blue-700">₩{(receiveModal.unitPrice * receiveModal.request.quantity).toLocaleString()}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setReceiveModal(null)}
                className="flex-1 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={handleConfirmReceive}
                disabled={submitting}
                className="flex-1 py-2.5 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-50"
              >
                {submitting ? '처리 중...' : '입고 확인'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
