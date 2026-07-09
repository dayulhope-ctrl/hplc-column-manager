'use client';

import { useEffect, useMemo, useState } from 'react';
import { FlaskConical, Search, Package, Beaker, X } from 'lucide-react';
import { ColumnModel, ColumnTestMapping } from '@/types';

interface Props {
  columns: ColumnModel[];
}

type Mode = 'product' | 'column';

export default function TestMappingTab({ columns }: Props) {
  const [mode, setMode] = useState<Mode>('product');
  const [all, setAll] = useState<ColumnTestMapping[]>([]);
  const [loading, setLoading] = useState(true);

  // 품목 검색
  const [productQuery, setProductQuery] = useState('');
  // 칼럼 검색
  const [columnQuery, setColumnQuery] = useState('');
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);

  // 전체 매핑 1회 로드 (317건 수준 → 클라이언트 필터가 빠름)
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/test-mappings');
        const data = await res.json();
        setAll(data.mappings || []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ── 품목 검색 결과: 품목별 그룹핑 ──
  const productGroups = useMemo(() => {
    const q = productQuery.trim().toLowerCase();
    const rows = q
      ? all.filter(m => m.product_name?.toLowerCase().includes(q))
      : all;
    const map = new Map<string, ColumnTestMapping[]>();
    for (const m of rows) {
      const key = m.product_name || '(미상)';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(m);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], 'ko'));
  }, [all, productQuery]);

  // ── 칼럼 검색: 후보 목록 (매핑 조인 데이터로 구성 → is_draft 신규 칼럼도 포함) ──
  interface ColRef {
    id: string; model_name: string; cat_no: string;
    size?: string | null; total_stock?: number; is_draft?: boolean; count: number;
  }
  const columnsWithMapping = useMemo<ColRef[]>(() => {
    const byId = new Map<string, ColRef>();
    for (const m of all) {
      if (!m.model_id) continue;
      const cm = m.column_models;
      const ref = byId.get(m.model_id);
      if (ref) ref.count++;
      else byId.set(m.model_id, {
        id: m.model_id,
        model_name: cm?.model_name || '(미상)',
        cat_no: cm?.cat_no || m.cat_no || '-',
        size: cm?.size ?? null,
        total_stock: cm?.total_stock,
        is_draft: cm?.is_draft,
        count: 1,
      });
    }
    const q = columnQuery.trim().toLowerCase();
    return [...byId.values()]
      .filter(c => !q || c.model_name.toLowerCase().includes(q) || c.cat_no.toLowerCase().includes(q))
      .sort((a, b) => a.model_name.localeCompare(b.model_name, 'ko'));
  }, [all, columnQuery]);

  const selectedColumnMappings = useMemo(
    () => all.filter(m => m.model_id === selectedModelId),
    [all, selectedModelId]
  );
  const selectedColumn = columnsWithMapping.find(c => c.id === selectedModelId) || null;

  const totalProducts = useMemo(
    () => new Set(all.map(m => m.product_name)).size, [all]);
  const totalColumns = useMemo(
    () => new Set(all.map(m => m.model_id).filter(Boolean)).size, [all]);

  return (
    <div>
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <FlaskConical className="w-5 h-5" />
          시험품목 / 항목
        </h2>
        <div className="flex gap-1 border border-gray-200 rounded-lg p-0.5 bg-gray-50">
          <button
            onClick={() => setMode('product')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${
              mode === 'product' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Beaker className="w-4 h-4" /> 품목으로 검색
          </button>
          <button
            onClick={() => setMode('column')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${
              mode === 'column' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Package className="w-4 h-4" /> 칼럼으로 검색
          </button>
        </div>
      </div>

      {/* 요약 통계 */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <StatBox label="총 매핑" value={`${all.length}건`} color="text-gray-800" />
        <StatBox label="시험품목" value={`${totalProducts}종`} color="text-blue-700" />
        <StatBox label="연결 칼럼" value={`${totalColumns}종`} color="text-green-700" />
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 py-16 text-center text-gray-400">
          로딩 중...
        </div>
      ) : mode === 'product' ? (
        /* ─────────── 품목으로 검색 ─────────── */
        <div>
          <SearchBox
            value={productQuery}
            onChange={setProductQuery}
            placeholder="시험품목 검색 (예: 에너지비타500맥스액)..."
          />
          <p className="text-xs text-gray-500 mb-3">{productGroups.length}개 품목</p>

          <div className="space-y-3">
            {productGroups.length === 0 ? (
              <Empty text="검색 결과가 없습니다" />
            ) : productGroups.map(([product, rows]) => (
              <div key={product} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 bg-blue-50/60 border-b flex items-center gap-2">
                  <Beaker className="w-4 h-4 text-blue-600 shrink-0" />
                  <span className="font-semibold text-gray-900">{product}</span>
                  <span className="text-xs text-gray-500">· 항목/칼럼 {rows.length}건</span>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-500">
                    <tr>
                      <th className="px-4 py-2 text-left w-1/3">시험항목</th>
                      <th className="px-4 py-2 text-left">사용 칼럼</th>
                      <th className="px-4 py-2 text-left">Cat. No</th>
                      <th className="px-4 py-2 text-center">재고</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {rows.map(r => (
                      <tr key={r.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2 font-medium text-gray-800">{r.test_item || '-'}</td>
                        <td className="px-4 py-2">
                          {r.column_models?.model_name || '-'}
                          {r.column_models?.is_draft && (
                            <span className="ml-1.5 px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-xs">신규</span>
                          )}
                        </td>
                        <td className="px-4 py-2 font-mono text-xs text-gray-500">{r.column_models?.cat_no || r.cat_no || '-'}</td>
                        <td className="px-4 py-2 text-center">
                          <StockBadge stock={r.column_models?.total_stock} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* ─────────── 칼럼으로 검색 ─────────── */
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {/* 좌: 칼럼 목록 */}
          <div className="md:col-span-2">
            <SearchBox
              value={columnQuery}
              onChange={setColumnQuery}
              placeholder="칼럼 모델명 / Cat. No..."
            />
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden max-h-[60vh] overflow-y-auto">
              {columnsWithMapping.length === 0 ? (
                <Empty text="칼럼이 없습니다" />
              ) : columnsWithMapping.map(c => (
                <button
                  key={c.id}
                  onClick={() => setSelectedModelId(c.id)}
                  className={`w-full text-left px-4 py-2.5 border-b last:border-b-0 hover:bg-blue-50 transition-colors flex items-center justify-between ${
                    selectedModelId === c.id ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="min-w-0">
                    <div className="font-medium text-sm text-gray-900 truncate">
                      {c.model_name}
                      {c.is_draft && (
                        <span className="ml-1.5 px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-xs">신규</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-400 font-mono">{c.cat_no}</div>
                  </div>
                  <span className="ml-2 shrink-0 px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs">{c.count}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 우: 선택 칼럼의 품목/항목 */}
          <div className="md:col-span-3">
            {!selectedColumn ? (
              <div className="bg-white rounded-xl border border-gray-200 py-16 text-center text-gray-400 text-sm">
                왼쪽에서 칼럼을 선택하세요
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 bg-green-50/60 border-b flex items-center gap-2">
                  <Package className="w-4 h-4 text-green-600 shrink-0" />
                  <div className="min-w-0">
                    <div className="font-semibold text-gray-900 truncate">{selectedColumn.model_name}</div>
                    <div className="text-xs text-gray-500 font-mono">
                      {selectedColumn.cat_no}
                      {selectedColumn.size ? ` · ${selectedColumn.size}` : ''}
                      {` · 재고 ${selectedColumn.total_stock ?? 0}`}
                    </div>
                  </div>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-500">
                    <tr>
                      <th className="px-4 py-2 text-left">시험품목</th>
                      <th className="px-4 py-2 text-left">시험항목</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {selectedColumnMappings.map(r => (
                      <tr key={r.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2 font-medium text-gray-800">{r.product_name}</td>
                        <td className="px-4 py-2 text-gray-600">{r.test_item || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SearchBox({ value, onChange, placeholder }: {
  value: string; onChange: (v: string) => void; placeholder: string;
}) {
  return (
    <div className="relative mb-3">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-10 pr-9 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
      />
      {value && (
        <button onClick={() => onChange('')}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3 text-center">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

function StockBadge({ stock }: { stock?: number }) {
  if (stock === undefined || stock === null) return <span className="text-xs text-gray-300">-</span>;
  return (
    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
      stock === 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
    }`}>
      {stock}
    </span>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="bg-white rounded-xl border border-gray-200 py-12 text-center text-gray-400 text-sm">{text}</div>;
}
