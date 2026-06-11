'use client';

import { useEffect, useMemo, useState } from 'react';
import { ColumnModel } from '@/types';
import { ShoppingCart, Edit, Trash2, AlertCircle, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';

type SortKey = 'model_name' | 'length' | 'inner' | 'particle_size' | 'total_stock';
type SortDir = 'asc' | 'desc';

const LS_SORT_KEY = 'hplc_column_sort';
const LS_FILTER_KEY = 'hplc_column_filter';

function parseSize(size: string | null | undefined): { length: number | null; inner: number | null } {
  if (!size) return { length: null, inner: null };
  const nums = size.match(/[\d.]+/g);
  if (!nums || nums.length < 2) return { length: Number(nums?.[0]) || null, inner: null };
  return { length: Number(nums[0]), inner: Number(nums[1]) };
}

interface ColumnTableProps {
  columns: ColumnModel[];
  isAdmin?: boolean;
  onRequestPurchase?: (column: ColumnModel) => void;
  onEdit?: (column: ColumnModel) => void;
  onDelete?: (column: ColumnModel) => void;
  onRowClick?: (column: ColumnModel) => void;
  usageMap?: Record<string, string[]>;
}

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (sortKey !== col) return <ArrowUpDown className="w-3 h-3 opacity-30" />;
  return sortDir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />;
}

export default function ColumnTable({ columns, isAdmin, onRequestPurchase, onEdit, onDelete, onRowClick, usageMap }: ColumnTableProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const [sortKey, setSortKey] = useState<SortKey>('model_name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [filterLength, setFilterLength] = useState<string>('');
  const [filterInner, setFilterInner] = useState<string>('');
  const [filterParticle, setFilterParticle] = useState<string>('');

  // localStorage 복원
  useEffect(() => {
    try {
      const s = localStorage.getItem(LS_SORT_KEY);
      if (s) {
        const { key, dir } = JSON.parse(s);
        if (key) setSortKey(key);
        if (dir) setSortDir(dir);
      }
    } catch {}
    try {
      const f = localStorage.getItem(LS_FILTER_KEY);
      if (f) {
        const { length, inner, particle } = JSON.parse(f);
        if (length !== undefined) setFilterLength(length);
        if (inner !== undefined) setFilterInner(inner);
        if (particle !== undefined) setFilterParticle(particle);
      }
    } catch {}
  }, []);

  // 정렬 상태 저장
  useEffect(() => {
    localStorage.setItem(LS_SORT_KEY, JSON.stringify({ key: sortKey, dir: sortDir }));
  }, [sortKey, sortDir]);

  // 필터 상태 저장
  useEffect(() => {
    localStorage.setItem(LS_FILTER_KEY, JSON.stringify({ length: filterLength, inner: filterInner, particle: filterParticle }));
  }, [filterLength, filterInner, filterParticle]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const resetFilters = () => {
    setFilterLength('');
    setFilterInner('');
    setFilterParticle('');
  };

  // 필터 드롭다운 고유값 (props.columns 전체 기준)
  const uniqueLengths = useMemo(() =>
    [...new Set(columns.map(c => parseSize(c.size).length).filter((v): v is number => v !== null))]
      .sort((a, b) => a - b),
    [columns]
  );
  const uniqueInners = useMemo(() =>
    [...new Set(columns.map(c => parseSize(c.size).inner).filter((v): v is number => v !== null))]
      .sort((a, b) => a - b),
    [columns]
  );
  const uniqueParticles = useMemo(() =>
    [...new Set(columns.map(c => c.particle_size).filter((v): v is number => v !== null))]
      .sort((a, b) => a - b),
    [columns]
  );

  // 필터 + 정렬 적용
  const processedColumns = useMemo(() => {
    let result = columns;

    if (filterLength) result = result.filter(c => parseSize(c.size).length === Number(filterLength));
    if (filterInner)  result = result.filter(c => parseSize(c.size).inner  === Number(filterInner));
    if (filterParticle) result = result.filter(c => String(c.particle_size) === filterParticle);

    return [...result].sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'length') {
        cmp = (parseSize(a.size).length ?? Infinity) - (parseSize(b.size).length ?? Infinity);
      } else if (sortKey === 'inner') {
        cmp = (parseSize(a.size).inner ?? Infinity) - (parseSize(b.size).inner ?? Infinity);
      } else if (sortKey === 'particle_size') {
        cmp = (a.particle_size ?? Infinity) - (b.particle_size ?? Infinity);
      } else if (sortKey === 'total_stock') {
        cmp = a.total_stock - b.total_stock;
      } else {
        cmp = a.model_name.localeCompare(b.model_name, 'ko');
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [columns, sortKey, sortDir, filterLength, filterInner, filterParticle]);

  const hasFilter = filterLength || filterInner || filterParticle;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      {/* 필터 바 */}
      <div className="px-4 py-2.5 border-b border-gray-100 flex flex-wrap gap-2 items-center text-xs text-gray-600 bg-gray-50">
        <span className="font-medium text-gray-500">필터:</span>

        <select
          value={filterLength}
          onChange={e => setFilterLength(e.target.value)}
          className="border border-gray-200 rounded-md px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
        >
          <option value="">길이 전체</option>
          {uniqueLengths.map(v => <option key={v} value={String(v)}>{v} mm</option>)}
        </select>

        <select
          value={filterInner}
          onChange={e => setFilterInner(e.target.value)}
          className="border border-gray-200 rounded-md px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
        >
          <option value="">내경 전체</option>
          {uniqueInners.map(v => <option key={v} value={String(v)}>{v} mm</option>)}
        </select>

        <select
          value={filterParticle}
          onChange={e => setFilterParticle(e.target.value)}
          className="border border-gray-200 rounded-md px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
        >
          <option value="">입자 전체</option>
          {uniqueParticles.map(v => <option key={v} value={String(v)}>{v} µm</option>)}
        </select>

        {hasFilter && (
          <button
            onClick={resetFilters}
            className="text-blue-600 hover:text-blue-800 hover:underline ml-1"
          >
            초기화
          </button>
        )}

        {hasFilter && (
          <span className="ml-auto text-gray-400">
            {processedColumns.length} / {columns.length}개
          </span>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider">
            <tr>
              <th
                className="px-4 py-3 text-left cursor-pointer select-none hover:bg-gray-100"
                onClick={() => handleSort('model_name')}
              >
                <span className="flex items-center gap-1">
                  모델명
                  <SortIcon col="model_name" sortKey={sortKey} sortDir={sortDir} />
                </span>
              </th>
              <th className="px-4 py-3 text-left">Cat. No</th>
              <th
                className="px-4 py-3 text-center hidden md:table-cell cursor-pointer select-none hover:bg-gray-100"
                onClick={() => handleSort('length')}
              >
                <span className="flex items-center justify-center gap-1">
                  길이(mm)
                  <SortIcon col="length" sortKey={sortKey} sortDir={sortDir} />
                </span>
              </th>
              <th
                className="px-4 py-3 text-center hidden md:table-cell cursor-pointer select-none hover:bg-gray-100"
                onClick={() => handleSort('inner')}
              >
                <span className="flex items-center justify-center gap-1">
                  내경(mm)
                  <SortIcon col="inner" sortKey={sortKey} sortDir={sortDir} />
                </span>
              </th>
              <th
                className="px-4 py-3 text-center hidden lg:table-cell cursor-pointer select-none hover:bg-gray-100"
                onClick={() => handleSort('particle_size')}
              >
                <span className="flex items-center justify-center gap-1">
                  입자
                  <SortIcon col="particle_size" sortKey={sortKey} sortDir={sortDir} />
                </span>
              </th>
              <th
                className="px-4 py-3 text-center cursor-pointer select-none hover:bg-gray-100"
                onClick={() => handleSort('total_stock')}
              >
                <span className="flex items-center justify-center gap-1">
                  재고
                  <SortIcon col="total_stock" sortKey={sortKey} sortDir={sortDir} />
                </span>
              </th>
              <th className="px-4 py-3 text-left hidden md:table-cell">KEP</th>
              <th className="px-4 py-3 text-right hidden lg:table-cell">단가</th>
              <th className="px-4 py-3 text-center">상태</th>
              <th className="px-4 py-3 text-center">액션</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {processedColumns.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-12 text-center text-gray-400">
                  데이터가 없습니다
                </td>
              </tr>
            ) : (
              processedColumns.map((col) => {
                const isLowStock = col.total_stock <= col.min_safety_stock;
                const isOutOfStock = col.total_stock === 0;
                const { length, inner } = parseSize(col.size);
                return (
                  <tr key={col.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      <div className="flex items-center gap-2">
                        {isOutOfStock && (
                          <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-500" />
                        )}
                        <div
                          className="inline-block"
                          onMouseEnter={(e) => {
                            if (usageMap?.[col.id]?.length) {
                              const rect = e.currentTarget.getBoundingClientRect();
                              setTooltipPos({ x: rect.left, y: rect.bottom + 6 });
                              setHoveredId(col.id);
                            }
                          }}
                          onMouseLeave={() => setHoveredId(null)}
                        >
                          {onRowClick ? (
                            <button
                              onClick={() => onRowClick(col)}
                              className="truncate max-w-[200px] text-left text-blue-700 hover:underline font-medium"
                            >
                              {col.model_name}
                            </button>
                          ) : (
                            <span className="truncate max-w-[200px] cursor-default">{col.model_name}</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 font-mono text-xs">{col.cat_no}</td>
                    <td className="px-4 py-3 text-center text-gray-600 hidden md:table-cell">
                      {length !== null ? length : '-'}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-600 hidden md:table-cell">
                      {inner !== null ? inner : '-'}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-600 hidden lg:table-cell">
                      {col.particle_size ? `${col.particle_size} µm` : '-'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded-full text-xs font-bold ${
                        isOutOfStock
                          ? 'bg-red-100 text-red-700'
                          : isLowStock
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-green-100 text-green-700'
                      }`}>
                        {col.total_stock}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 font-mono text-xs hidden md:table-cell">{col.kep_code || '-'}</td>
                    <td className="px-4 py-3 text-right text-gray-700 hidden lg:table-cell">
                      ₩{col.unit_price.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {col.purchase_status === '발주 완료' ? (
                        <span className="inline-flex px-2 py-0.5 rounded-full text-xs bg-purple-100 text-purple-700">
                          발주됨
                        </span>
                      ) : col.purchase_status === '구매 승인' ? (
                        <span className="inline-flex px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700">
                          구매 대기
                        </span>
                      ) : isOutOfStock ? (
                        <span className="inline-flex px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700">
                          품절
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        {onRequestPurchase && (
                          <button
                            onClick={() => onRequestPurchase(col)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="구매 요청"
                          >
                            <ShoppingCart className="w-4 h-4" />
                          </button>
                        )}
                        {isAdmin && onEdit && (
                          <button
                            onClick={() => onEdit(col)}
                            className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            title="수정"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                        )}
                        {isAdmin && onDelete && (
                          <button
                            onClick={() => onDelete(col)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="삭제"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {/* 사용 제품 목록 툴팁 */}
      {hoveredId && usageMap?.[hoveredId]?.length ? (
        <div
          className="fixed z-[9999] bg-white border border-gray-200 rounded-lg shadow-xl p-3 min-w-[180px] max-w-[260px] pointer-events-none"
          style={{ left: tooltipPos.x, top: tooltipPos.y }}
        >
          <p className="text-xs font-semibold text-gray-500 mb-1.5">사용 제품 목록</p>
          <ul className="space-y-0.5">
            {usageMap[hoveredId].map((name, i) => (
              <li key={i} className="text-xs text-gray-700">{i + 1}. {name}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
