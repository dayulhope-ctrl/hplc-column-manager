'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ColumnModel } from '@/types';
import { ShoppingCart, Edit, Trash2, AlertCircle, ArrowUp, ArrowDown, ArrowUpDown, ChevronDown, Check } from 'lucide-react';

type SortKey = 'model_name' | 'length' | 'inner' | 'particle_size' | 'total_stock';
type SortDir = 'asc' | 'desc';

const LS_SORT_KEY   = 'hplc_column_sort';
const LS_FILTER_KEY = 'hplc_column_filter';

function parseSize(size: string | null | undefined): { length: number | null; inner: number | null } {
  if (!size) return { length: null, inner: null };
  const nums = size.match(/[\d.]+/g);
  if (!nums || nums.length < 2) return { length: Number(nums?.[0]) || null, inner: null };
  return { length: Number(nums[0]), inner: Number(nums[1]) };
}

// ── 엑셀 스타일 다중 선택 필터 컴포넌트 ──
interface MultiSelectFilterProps {
  label: string;
  options: string[];           // 고유값 목록 (표시용 문자열)
  selected: Set<string>;       // 현재 선택된 값 Set
  onApply: (next: Set<string>) => void;
  formatOption?: (v: string) => string;  // 표시 포맷 함수
}

function MultiSelectFilter({ label, options, selected, onApply, formatOption }: MultiSelectFilterProps) {
  const [open, setOpen] = useState(false);
  const [temp, setTemp] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  // 열 때 현재 선택값으로 임시 상태 초기화
  const handleOpen = () => {
    setTemp(new Set(selected));
    setSearch('');
    setOpen(true);
  };

  // 바깥 클릭 닫기
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const filtered = options.filter(v =>
    search === '' || v.toLowerCase().includes(search.toLowerCase())
  );

  const allChecked = filtered.length > 0 && filtered.every(v => temp.has(v));
  const someChecked = filtered.some(v => temp.has(v));

  const toggleAll = () => {
    if (allChecked) {
      const next = new Set(temp);
      filtered.forEach(v => next.delete(v));
      setTemp(next);
    } else {
      const next = new Set(temp);
      filtered.forEach(v => next.add(v));
      setTemp(next);
    }
  };

  const toggleOne = (v: string) => {
    const next = new Set(temp);
    next.has(v) ? next.delete(v) : next.add(v);
    setTemp(next);
  };

  const handleApply = () => {
    onApply(temp);
    setOpen(false);
  };

  const handleCancel = () => setOpen(false);

  const isFiltered = selected.size > 0;

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={handleOpen}
        className={`flex items-center gap-1 px-2.5 py-1 rounded-md border text-xs transition-colors ${
          isFiltered
            ? 'border-blue-400 bg-blue-50 text-blue-700 font-semibold'
            : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
        }`}
      >
        {label}
        {isFiltered && (
          <span className="bg-blue-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-bold">
            {selected.size}
          </span>
        )}
        <ChevronDown className="w-3 h-3 opacity-60" />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-[9999] bg-white border border-gray-200 rounded-xl shadow-xl w-52">
          {/* 검색 */}
          <div className="p-2 border-b border-gray-100">
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="검색..."
              className="w-full px-2 py-1 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-300"
            />
          </div>

          {/* 모두 선택 */}
          <div className="px-3 py-2 border-b border-gray-100">
            <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-semibold text-gray-700">
              <div
                onClick={toggleAll}
                className={`w-4 h-4 rounded border flex items-center justify-center cursor-pointer ${
                  allChecked ? 'bg-blue-500 border-blue-500' : someChecked ? 'bg-blue-200 border-blue-300' : 'border-gray-300'
                }`}
              >
                {(allChecked || someChecked) && <Check className="w-2.5 h-2.5 text-white" />}
              </div>
              (모두 선택)
            </label>
          </div>

          {/* 값 목록 */}
          <div className="max-h-48 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-3">검색 결과 없음</p>
            ) : filtered.map(v => (
              <label key={v} className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 cursor-pointer select-none text-xs text-gray-700">
                <div
                  onClick={() => toggleOne(v)}
                  className={`w-4 h-4 rounded border flex items-center justify-center cursor-pointer flex-shrink-0 ${
                    temp.has(v) ? 'bg-blue-500 border-blue-500' : 'border-gray-300'
                  }`}
                >
                  {temp.has(v) && <Check className="w-2.5 h-2.5 text-white" />}
                </div>
                <span onClick={() => toggleOne(v)}>{formatOption ? formatOption(v) : v}</span>
              </label>
            ))}
          </div>

          {/* 확인/취소 버튼 */}
          <div className="flex gap-1.5 p-2 border-t border-gray-100">
            <button
              onClick={handleCancel}
              className="flex-1 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600"
            >
              취소
            </button>
            <button
              onClick={handleApply}
              className="flex-1 py-1.5 text-xs bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-medium"
            >
              확인
            </button>
          </div>
        </div>
      )}
    </div>
  );
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
  const [filterLengths,   setFilterLengths]   = useState<Set<string>>(new Set());
  const [filterInners,    setFilterInners]     = useState<Set<string>>(new Set());
  const [filterParticles, setFilterParticles]  = useState<Set<string>>(new Set());

  // localStorage 복원
  useEffect(() => {
    try {
      const s = localStorage.getItem(LS_SORT_KEY);
      if (s) { const { key, dir } = JSON.parse(s); if (key) setSortKey(key); if (dir) setSortDir(dir); }
    } catch {}
    try {
      const f = localStorage.getItem(LS_FILTER_KEY);
      if (f) {
        const { lengths, inners, particles } = JSON.parse(f);
        if (Array.isArray(lengths))   setFilterLengths(new Set(lengths));
        if (Array.isArray(inners))    setFilterInners(new Set(inners));
        if (Array.isArray(particles)) setFilterParticles(new Set(particles));
      }
    } catch {}
  }, []);

  // 정렬 저장
  useEffect(() => {
    localStorage.setItem(LS_SORT_KEY, JSON.stringify({ key: sortKey, dir: sortDir }));
  }, [sortKey, sortDir]);

  // 필터 저장
  useEffect(() => {
    localStorage.setItem(LS_FILTER_KEY, JSON.stringify({
      lengths:   [...filterLengths],
      inners:    [...filterInners],
      particles: [...filterParticles],
    }));
  }, [filterLengths, filterInners, filterParticles]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const resetFilters = () => {
    setFilterLengths(new Set());
    setFilterInners(new Set());
    setFilterParticles(new Set());
  };

  // 필터 드롭다운 고유값 (props.columns 전체 기준, 숫자 오름차순)
  const uniqueLengths = useMemo(() =>
    [...new Set(columns.map(c => parseSize(c.size).length).filter((v): v is number => v !== null))]
      .sort((a, b) => a - b).map(String),
    [columns]
  );
  const uniqueInners = useMemo(() =>
    [...new Set(columns.map(c => parseSize(c.size).inner).filter((v): v is number => v !== null))]
      .sort((a, b) => a - b).map(String),
    [columns]
  );
  const uniqueParticles = useMemo(() =>
    [...new Set(columns.map(c => c.particle_size).filter((v): v is number => v !== null))]
      .sort((a, b) => a - b).map(String),
    [columns]
  );

  // 필터 + 정렬
  const processedColumns = useMemo(() => {
    let result = columns;
    if (filterLengths.size > 0)
      result = result.filter(c => { const l = parseSize(c.size).length; return l !== null && filterLengths.has(String(l)); });
    if (filterInners.size > 0)
      result = result.filter(c => { const i = parseSize(c.size).inner; return i !== null && filterInners.has(String(i)); });
    if (filterParticles.size > 0)
      result = result.filter(c => c.particle_size !== null && filterParticles.has(String(c.particle_size)));

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
  }, [columns, sortKey, sortDir, filterLengths, filterInners, filterParticles]);

  const hasFilter = filterLengths.size > 0 || filterInners.size > 0 || filterParticles.size > 0;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      {/* 필터 바 */}
      <div className="px-4 py-2.5 border-b border-gray-100 flex flex-wrap gap-2 items-center bg-gray-50">
        <span className="text-xs font-medium text-gray-500">필터:</span>

        <MultiSelectFilter
          label="길이(mm)"
          options={uniqueLengths}
          selected={filterLengths}
          onApply={setFilterLengths}
          formatOption={v => `${v} mm`}
        />
        <MultiSelectFilter
          label="내경(mm)"
          options={uniqueInners}
          selected={filterInners}
          onApply={setFilterInners}
          formatOption={v => `${v} mm`}
        />
        <MultiSelectFilter
          label="입자(µm)"
          options={uniqueParticles}
          selected={filterParticles}
          onApply={setFilterParticles}
          formatOption={v => `${v} µm`}
        />

        {hasFilter && (
          <>
            <button
              onClick={resetFilters}
              className="text-xs text-red-500 hover:text-red-700 hover:underline ml-1"
            >
              전체 초기화
            </button>
            <span className="ml-auto text-xs text-gray-400">
              {processedColumns.length} / {columns.length}개
            </span>
          </>
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
                  모델명 <SortIcon col="model_name" sortKey={sortKey} sortDir={sortDir} />
                </span>
              </th>
              <th className="px-4 py-3 text-left">Cat. No</th>
              <th
                className="px-4 py-3 text-center hidden md:table-cell cursor-pointer select-none hover:bg-gray-100"
                onClick={() => handleSort('length')}
              >
                <span className="flex items-center justify-center gap-1">
                  길이(MM) <SortIcon col="length" sortKey={sortKey} sortDir={sortDir} />
                </span>
              </th>
              <th
                className="px-4 py-3 text-center hidden md:table-cell cursor-pointer select-none hover:bg-gray-100"
                onClick={() => handleSort('inner')}
              >
                <span className="flex items-center justify-center gap-1">
                  내경(MM) <SortIcon col="inner" sortKey={sortKey} sortDir={sortDir} />
                </span>
              </th>
              <th
                className="px-4 py-3 text-center hidden lg:table-cell cursor-pointer select-none hover:bg-gray-100"
                onClick={() => handleSort('particle_size')}
              >
                <span className="flex items-center justify-center gap-1">
                  입자 <SortIcon col="particle_size" sortKey={sortKey} sortDir={sortDir} />
                </span>
              </th>
              <th
                className="px-4 py-3 text-center cursor-pointer select-none hover:bg-gray-100"
                onClick={() => handleSort('total_stock')}
              >
                <span className="flex items-center justify-center gap-1">
                  재고 <SortIcon col="total_stock" sortKey={sortKey} sortDir={sortDir} />
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
                const isLowStock  = col.total_stock <= col.min_safety_stock;
                const isOutOfStock = col.total_stock === 0;
                const { length, inner } = parseSize(col.size);
                return (
                  <tr key={col.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      <div className="flex items-center gap-2">
                        {isOutOfStock && <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-500" />}
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
                        <span className="inline-flex px-2 py-0.5 rounded-full text-xs bg-purple-100 text-purple-700">발주됨</span>
                      ) : col.purchase_status === '구매 승인' ? (
                        <span className="inline-flex px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700">구매 대기</span>
                      ) : isOutOfStock ? (
                        <span className="inline-flex px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700">품절</span>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        {onRequestPurchase && (
                          <button onClick={() => onRequestPurchase(col)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="구매 요청">
                            <ShoppingCart className="w-4 h-4" />
                          </button>
                        )}
                        {isAdmin && onEdit && (
                          <button onClick={() => onEdit(col)} className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors" title="수정">
                            <Edit className="w-4 h-4" />
                          </button>
                        )}
                        {isAdmin && onDelete && (
                          <button onClick={() => onDelete(col)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="삭제">
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
