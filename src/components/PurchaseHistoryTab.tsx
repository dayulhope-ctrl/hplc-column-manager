'use client';

import { useEffect, useState } from 'react';
import { ClipboardList, Download, ChevronDown, ChevronUp } from 'lucide-react';
import { ReceivingRecord, MonthlyClosing } from '@/types';

export default function PurchaseHistoryTab() {
  const [receivings, setReceivings] = useState<ReceivingRecord[]>([]);
  const [closings, setClosings] = useState<MonthlyClosing[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedClosing, setExpandedClosing] = useState<string | null>(null);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      const [recRes, closRes] = await Promise.all([
        fetch('/api/receivings'),
        fetch('/api/closings'),
      ]);
      setReceivings((await recRes.json()).records || []);
      setClosings((await closRes.json()).closings || []);
      setLoading(false);
    };
    fetchAll();
  }, []);

  // Group by cat_no for summary table
  const grouped = receivings.reduce<Record<string, {
    cat_no: string; kep_code: string; model_name: string;
    size: string; particle_size: number | null; unit_price: number;
    totalQty: number; totalAmt: number;
  }>>((acc, r) => {
    const key = r.cat_no;
    if (!acc[key]) {
      acc[key] = {
        cat_no: r.cat_no, kep_code: r.kep_code || '-', model_name: r.model_name,
        size: r.size || '-', particle_size: r.particle_size,
        unit_price: r.unit_price || 0, totalQty: 0, totalAmt: 0,
      };
    }
    acc[key].totalQty += r.quantity;
    acc[key].totalAmt += r.total_price || 0;
    return acc;
  }, {});
  const groupedRows = Object.values(grouped).sort((a, b) => b.totalAmt - a.totalAmt);

  const grandTotalQty = groupedRows.reduce((s, r) => s + r.totalQty, 0);
  const grandTotalAmt = groupedRows.reduce((s, r) => s + r.totalAmt, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <ClipboardList className="w-5 h-5" />
          총 구매내역
        </h2>
        <a href="/api/export/receivings" download
          className="px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-1.5 text-sm">
          <Download className="w-4 h-4" /> 엑셀 다운로드
        </a>
      </div>

      {/* 칼럼별 집계 테이블 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-600 border-b">
              <tr>
                <th className="px-4 py-3 text-left">Cat. No</th>
                <th className="px-4 py-3 text-left">KEP 코드</th>
                <th className="px-4 py-3 text-left">모델명</th>
                <th className="px-4 py-3 text-left">사이즈</th>
                <th className="px-4 py-3 text-center">입자크기</th>
                <th className="px-4 py-3 text-right">단가</th>
                <th className="px-4 py-3 text-center">총 구매수량</th>
                <th className="px-4 py-3 text-right">총 구매금액</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-400">로딩 중...</td></tr>
              ) : groupedRows.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-400">구매 내역이 없습니다</td></tr>
              ) : groupedRows.map(row => (
                <tr key={row.cat_no} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-mono text-xs">{row.cat_no}</td>
                  <td className="px-4 py-2 font-mono text-xs">{row.kep_code}</td>
                  <td className="px-4 py-2 font-medium">{row.model_name}</td>
                  <td className="px-4 py-2 text-xs text-gray-600">{row.size}</td>
                  <td className="px-4 py-2 text-center text-xs">
                    {row.particle_size ? `${row.particle_size} µm` : '-'}
                  </td>
                  <td className="px-4 py-2 text-right">₩{row.unit_price.toLocaleString()}</td>
                  <td className="px-4 py-2 text-center font-semibold">{row.totalQty}</td>
                  <td className="px-4 py-2 text-right font-semibold text-blue-700">₩{row.totalAmt.toLocaleString()}</td>
                </tr>
              ))}
              {!loading && groupedRows.length > 0 && (
                <tr className="bg-gray-100 font-bold text-sm">
                  <td colSpan={6} className="px-4 py-2">총계</td>
                  <td className="px-4 py-2 text-center">{grandTotalQty}</td>
                  <td className="px-4 py-2 text-right text-blue-700">₩{grandTotalAmt.toLocaleString()}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 월별 마감내역 */}
      <div>
        <h3 className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
          <ClipboardList className="w-4 h-4" />
          월별 마감내역
        </h3>
        <div className="space-y-3">
          {loading ? (
            <div className="bg-white rounded-xl border p-8 text-center text-gray-400">로딩 중...</div>
          ) : closings.length === 0 ? (
            <div className="bg-white rounded-xl border p-8 text-center text-gray-400">결산 내역이 없습니다</div>
          ) : closings.map(c => {
            const records: any[] = Array.isArray(c.records) ? c.records : [];
            const isExpanded = expandedClosing === c.id;
            return (
              <div key={c.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {/* 월별 헤더 */}
                <button
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 text-left"
                  onClick={() => setExpandedClosing(isExpanded ? null : c.id)}
                >
                  <div className="flex items-center gap-3">
                    <div>
                      <span className="font-semibold text-gray-900">{c.month} 마감</span>
                      <span className="ml-2 text-xs text-gray-500">
                        마감일: {c.closing_date} · {records.length}건
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-bold text-blue-700">
                      마감 합계 ₩{c.total_price?.toLocaleString()}
                    </span>
                    <div className="flex gap-2">
                      <a
                        href={`/api/export/closings?year=${c.month.slice(0, 4)}`}
                        download
                        onClick={e => e.stopPropagation()}
                        className="px-2 py-0.5 text-xs border rounded hover:bg-gray-100 flex items-center gap-1"
                      >
                        <Download className="w-3 h-3" /> 내보내기
                      </a>
                    </div>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  </div>
                </button>

                {/* 월별 상세 기록 */}
                {isExpanded && (
                  <div className="border-t">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-xs text-gray-600">
                          <tr>
                            <th className="px-4 py-2 text-left">발주일</th>
                            <th className="px-4 py-2 text-left">KEP 코드</th>
                            <th className="px-4 py-2 text-left">모델명</th>
                            <th className="px-4 py-2 text-left">Cat. No</th>
                            <th className="px-4 py-2 text-left">사이즈</th>
                            <th className="px-4 py-2 text-center">입자크기</th>
                            <th className="px-4 py-2 text-center">구매수량</th>
                            <th className="px-4 py-2 text-right">단가</th>
                            <th className="px-4 py-2 text-right">입고금액</th>
                            <th className="px-4 py-2 text-left">입고일</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {records.map((r: any, i: number) => (
                            <tr key={i} className="hover:bg-gray-50">
                              <td className="px-4 py-2 text-xs">{r.order_date || '-'}</td>
                              <td className="px-4 py-2 font-mono text-xs">{r.kep_code || '-'}</td>
                              <td className="px-4 py-2 font-medium text-sm">{r.model_name}</td>
                              <td className="px-4 py-2 font-mono text-xs">{r.cat_no}</td>
                              <td className="px-4 py-2 text-xs">{r.size || '-'}</td>
                              <td className="px-4 py-2 text-center text-xs">
                                {r.particle_size ? `${r.particle_size} µm` : '-'}
                              </td>
                              <td className="px-4 py-2 text-center">{r.quantity}</td>
                              <td className="px-4 py-2 text-right text-xs">₩{r.unit_price?.toLocaleString() || '-'}</td>
                              <td className="px-4 py-2 text-right font-semibold">₩{r.total_price?.toLocaleString() || '-'}</td>
                              <td className="px-4 py-2 text-xs">{r.receiving_date}</td>
                            </tr>
                          ))}
                          <tr className="bg-gray-50 font-semibold text-sm">
                            <td colSpan={6} className="px-4 py-2 text-gray-700">소계</td>
                            <td className="px-4 py-2 text-center">{c.total_quantity}</td>
                            <td className="px-4 py-2"></td>
                            <td className="px-4 py-2 text-right text-blue-700">₩{c.total_price?.toLocaleString()}</td>
                            <td className="px-4 py-2"></td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
