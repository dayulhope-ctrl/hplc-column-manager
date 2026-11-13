'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ColumnModel } from '@/types';
import { ShoppingCart, Edit, Trash2, AlertCircle, ChevronDown, Check } from 'lucide-react';

const LS_FILTER_KEY = 'hplc_column_filter';
const LS_TYPE_KEY = 'hplc_column_type_tab';
type TypeTab = 'all' | 'LC' | 'GC';
const typeOf = (c: ColumnModel): 'LC' | 'GC' => (c.column_type === 'GC' ? 'GC' : 'LC');

// 사이즈 글자에서 길이·내경 읽기
// - 적힌 순서와 상관없이 큰 숫자 = 길이, 작은 숫자 = 내경 (칼럼은 항상 길이가 내경보다 길다)
//   예) 4.6mm × 250mm, 150 x 4.6 mm, 30m X 0.25mm, 0.32 x 30
// - 길이 단위: 숫자 바로 뒤가 m(mm 아님)이면 m, GC 칼럼이면 m, 그 외 mm
// - lengthKey 는 필터·표시용 문자열 ("250 mm", "30 m")
function parseSize(
  size: string | null | undefined,
  type: 'LC' | 'GC' = 'LC'
): { length: number | null; inner: number | null; lengthUnit: 'mm' | 'm'; lengthKey: string | null } {
  const empty = { length: null, inner: null, lengthUnit: 'mm' as const, lengthKey: null };
  if (!size) return empty;
  const nums = (size.match(/\d+(?:\.\d+)?/g) || []).map(Number).filter(n => n > 0);
  if (nums.length < 2) return empty;
  const length = Math.max(nums[0], nums[1]);
  const inner = Math.min(nums[0], nums[1]);
  const meterInText = /\d\s*m(?!m)/i.test(size);
  const lengthUnit: 'mm' | 'm' = meterInText || type === 'GC' ? 'm' : 'mm';
  return { length, inner, lengthUnit, lengthKey: `${length} ${lengthUnit}` };
}
const lengthKeyToMm = (k: string) => {
  const [n, u] = k.split(' ');
  return Number(n) * (u === 'm' ? 1000 : 1);
};

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
  mappingMap?: Record<string, { product_name: string; test_item: string | null }[]>;
  onChangeType?: (column: ColumnModel, next: 'LC' | 'GC') => void;
}


export default function ColumnTable({ columns: allColumns, isAdmin, onRequestPurchase, onEdit, onDelete, onRowClick, mappingMap, onChangeType }: ColumnTableProps) {
  const [typeTab, setTypeTab] = useState<TypeTab>('all');
  useEffect(() => {
    try {
      const t = localStorage.getItem(LS_TYPE_KEY);
      if (t === 'LC' || t === 'GC' || t === 'all') setTypeTab(t);
    } catch {}
  }, []);
  const changeTypeTab = (t: TypeTab) => {
    setTypeTab(t);
    try { localStorage.setItem(LS_TYPE_KEY, t); } catch {}
  };
  const typeCounts = useMemo(() => ({
    all: allColumns.length,
    LC: allColumns.filter(c => typeOf(c) === 'LC').length,
    GC: allColumns.filter(c => typeOf(c) === 'GC').length,
  }), [allColumns]);
  // 이하 필터·표는 고른 종류(LC/GC) 안에서만 동작
  // LC 탭은 mm, GC 탭은 m 로 단위를 머리글에만 쓴다. 전체 탭은 단위가 섞이므로 값마다 단위를 붙인다.
  const lengthUnitHeader = typeTab === 'LC' ? 'mm' : typeTab === 'GC' ? 'm' : null;
  const showLength = (k: string) => (lengthUnitHeader ? k.split(' ')[0] : k);
  const columns = useMemo(
    () => (typeTab === 'all' ? allColumns : allColumns.filter(c => typeOf(c) === typeTab)),
    [allColumns, typeTab]
  );
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const [filterLengths,   setFilterLengths]   = useState<Set<string>>(new Set());
  const [filterInners,    setFilterInners]     = useState<Set<string>>(new Set());
  const [filterParticles, setFilterParticles]  = useState<Set<string>>(new Set());

  // localStorage 복원
  useEffect(() => {
    try {
      const f = localStorage.getItem(LS_FILTER_KEY);
      if (f) {
        const { lengths, inners, particles } = JSON.parse(f);
        // 예전 저장값("250"처럼 단위 없음)은 버린다
        if (Array.isArray(lengths))   setFilterLengths(new Set(lengths.filter((v: unknown) => typeof v === 'string' && /\s(mm|m)$/.test(v))));
        if (Array.isArray(inners))    setFilterInners(new Set(inners));
        if (Array.isArray(particles)) setFilterParticles(new Set(particles));
      }
    } catch {}
  }, []);

  // 필터 저장
  useEffect(() => {
    localStorage.setItem(LS_FILTER_KEY, JSON.stringify({
      lengths:   [...filterLengths],
      inners:    [...filterInners],
      particles: [...filterParticles],
    }));
  }, [filterLengths, filterInners, filterParticles]);

  const resetFilters = () => {
    setFilterLengths(new Set());
    setFilterInners(new Set());
    setFilterParticles(new Set());
  };

  // 필터 드롭다운 고유값 (props.columns 전체 기준, 숫자 오름차순)
  const uniqueLengths = useMemo(() =>
    [...new Set(columns.map(c => parseSize(c.size, typeOf(c)).lengthKey).filter((v): v is string => v !== null))]
      .sort((a, b) => lengthKeyToMm(a) - lengthKeyToMm(b)),
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
      result = result.filter(c => { const k = parseSize(c.size, typeOf(c)).lengthKey; return k !== null && filterLengths.has(k); });
    if (filterInners.size > 0)
      result = result.filter(c => { const i = parseSize(c.size).inner; return i !== null && filterInners.has(String(i)); });
    if (filterParticles.size > 0)
      result = result.filter(c => c.particle_size !== null && filterParticles.has(String(c.particle_size)));

    return result;
  }, [columns, filterLengths, filterInners, filterParticles]);

  const hasFilter = filterLengths.size > 0 || filterInners.size > 0 || filterParticles.size > 0;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      {/* 필터 바 */}
      <div className="px-4 py-2.5 border-b border-gray-100 flex flex-wrap gap-2 items-center bg-gray-50">
        <div className="flex rounded-lg border border-gray-200 bg-white p-0.5 mr-1">
          {(['all', 'LC', 'GC'] as const).map(t => (
            <button
              key={t}
              onClick={() => changeTypeTab(t)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                typeTab === t
                  ? (t === 'GC' ? 'bg-emerald-600 text-white' : t === 'LC' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-white')
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {t === 'all' ? '전체' : t} <span className="opacity-75">{typeCounts[t]}</span>
            </button>
          ))}
        </div>
        <span className="text-xs font-medium text-gray-500">필터:</span>

        <MultiSelectFilter
          label={lengthUnitHeader ? `길이(${lengthUnitHeader})` : '길이'}
          options={uniqueLengths}
          selected={filterLengths}
          onApply={setFilterLengths}
          formatOption={showLength}
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
              <th className="px-3 py-3 text-center">종류</th>
              <th className="px-4 py-3 text-left">모델명</th>
              <th className="px-4 py-3 text-left">Cat. No</th>
              <th className="px-4 py-3 text-center hidden md:table-cell">{lengthUnitHeader ? `길이(${lengthUnitHeader})` : '길이'}</th>
              <th className="px-4 py-3 text-center hidden md:table-cell">내경(MM)</th>
              <th className="px-4 py-3 text-center hidden lg:table-cell normal-case">입자(µm)</th>
              <th className="px-4 py-3 text-center">재고</th>
              <th className="px-4 py-3 text-left hidden md:table-cell">KEP</th>
              <th className="px-4 py-3 text-right hidden lg:table-cell">단가</th>
              <th className="px-4 py-3 text-center">상태</th>
              <th className="px-4 py-3 text-center">액션</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {processedColumns.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-4 py-12 text-center text-gray-400">
                  데이터가 없습니다
                </td>
              </tr>
            ) : (
              processedColumns.map((col) => {
                const isLowStock  = col.total_stock <= col.min_safety_stock;
                const isOutOfStock = col.total_stock === 0;
                const { inner, lengthKey } = parseSize(col.size, typeOf(col));
                return (
                  <tr key={col.id} className="hover:bg-gray-50">
                    <td className="px-3 py-3 text-center">
                      {(() => {
                        const t = typeOf(col);
                        const cls = `inline-flex px-2 py-0.5 rounded-full text-xs font-bold ${
                          t === 'GC' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                        }`;
                        const next = t === 'GC' ? 'LC' : 'GC';
                        return isAdmin && onChangeType ? (
                          <button
                            onClick={() => onChangeType(col, next)}
                            className={`${cls} hover:ring-2 hover:ring-offset-1 ${t === 'GC' ? 'hover:ring-emerald-300' : 'hover:ring-blue-300'}`}
                            title={`눌러서 ${next}로 옮기기`}
                          >
                            {t} ⇄
                          </button>
                        ) : (
                          <span className={cls}>{t}</span>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      <div className="flex items-center gap-2">
                        {isOutOfStock && <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-500" />}
                        <div
                          className="inline-block"
                          onMouseEnter={(e) => {
                            if (mappingMap?.[col.id]?.length) {
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
                      {lengthKey ? showLength(lengthKey) : '-'}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-600 hidden md:table-cell">
                      {inner !== null ? inner : '-'}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-600 hidden lg:table-cell">
                      {col.particle_size ? col.particle_size : '-'}
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

      {/* 시험품목/항목 툴팁 (칼럼 마스터) */}
      {hoveredId && mappingMap?.[hoveredId]?.length ? (
        <div
          className="fixed z-[9999] bg-white border border-gray-200 rounded-lg shadow-xl p-3 min-w-[200px] max-w-[300px] pointer-events-none"
          style={{ left: tooltipPos.x, top: tooltipPos.y }}
        >
          <p className="text-xs font-semibold text-gray-500 mb-1.5">시험품목 / 항목</p>
          <ul className="space-y-0.5">
            {mappingMap[hoveredId].map((m, i) => (
              <li key={i} className="text-xs text-gray-700">
                {i + 1}. {m.product_name}
                {m.test_item ? <span className="text-gray-400"> — {m.test_item}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
