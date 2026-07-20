'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Search, Package } from 'lucide-react';
import ColumnTable from '@/components/ColumnTable';
import { ColumnModel } from '@/types';

const FILTER_OPTIONS = [
  { value: 'all',        label: '전체' },
  { value: 'low_stock',  label: '재고 부족' },
  { value: 'out_stock',  label: '재고 없음' },
  { value: 'ordered',    label: '발주 완료' },
];

export default function StockClient() {
  const router = useRouter();
  const [columns, setColumns] = useState<ColumnModel[]>([]);
  const [loading, setLoading]  = useState(true);
  const [search, setSearch]    = useState('');
  const [filter, setFilter]    = useState('all');

  useEffect(() => {
    fetch('/api/columns')
      .then(r => r.json())
      .then(d => setColumns(d.columns || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    let result = columns;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(c =>
        c.model_name.toLowerCase().includes(q) ||
        c.cat_no.toLowerCase().includes(q) ||
        (c.kep_code?.toLowerCase().includes(q))
      );
    }
    if (filter === 'low_stock') result = result.filter(c => c.total_stock > 0 && c.total_stock <= c.min_safety_stock);
    if (filter === 'out_stock') result = result.filter(c => c.total_stock === 0);
    if (filter === 'ordered')   result = result.filter(c => c.purchase_status === '발주 완료');
    return result;
  }, [columns, search, filter]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 상단 헤더 */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => router.push('/')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-600"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-blue-600" />
            <h1 className="font-bold text-gray-900">칼럼 재고 조회</h1>
          </div>
          {!loading && (
            <span className="ml-2 text-xs text-gray-400">총 {columns.length}종</span>
          )}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-4">
        {/* 검색창 (크게) */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-blue-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="모델명, Cat. No, KEP 코드 검색..."
                className="w-full h-14 pl-12 pr-4 text-base border-2 border-blue-200 focus:border-blue-500 rounded-xl outline-none shadow-sm transition-colors"
              />
            </div>
            <select
              value={filter}
              onChange={e => setFilter(e.target.value)}
              className="h-14 px-4 border-2 border-gray-200 rounded-xl text-sm bg-white focus:border-blue-400 outline-none min-w-[120px]"
            >
              {FILTER_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          {search && (
            <p className="text-xs text-gray-500 mt-2 ml-1">
              <span className="font-medium text-blue-600">{filtered.length}건</span> 검색됨
            </p>
          )}
        </div>

        {/* 칼럼 테이블 */}
        {loading ? (
          <div className="bg-white rounded-xl border border-gray-100 p-16 text-center text-gray-400">
            <Package className="w-10 h-10 mx-auto mb-3 text-gray-300 animate-pulse" />
            <p>데이터를 불러오는 중...</p>
          </div>
        ) : (
          <ColumnTable
            columns={filtered}
            isAdmin={false}
          />
        )}
      </div>
    </div>
  );
}
