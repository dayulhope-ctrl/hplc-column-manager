'use client';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts';

interface BudgetData {
  annual: number;
  used: number;
  remaining: number;
  usageRate: number;
  monthly: { label: string; amount: number }[];
}

interface Props {
  data: BudgetData;
}

const COLORS = ['#3b82f6', '#e5e7eb'];

export default function BudgetChart({ data }: Props) {
  const fmt = (v: number) => `₩${(v / 10000).toFixed(0)}만`;
  const year = new Date().getFullYear();

  // 예산 초과 여부
  const isOver = data.used > data.annual;
  const barColor = data.usageRate >= 90 ? '#ef4444' : data.usageRate >= 70 ? '#f59e0b' : '#3b82f6';

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">{year}년 예산 소진 현황</h3>

      {/* 예산 요약 */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="text-center bg-gray-50 rounded-lg p-2">
          <p className="text-xs text-gray-500">연간 예산</p>
          <p className="text-sm font-bold text-gray-800">₩{(data.annual / 10000).toLocaleString()}만</p>
        </div>
        <div className="text-center bg-blue-50 rounded-lg p-2">
          <p className="text-xs text-gray-500">소진 금액</p>
          <p className={`text-sm font-bold ${isOver ? 'text-red-600' : 'text-blue-700'}`}>
            ₩{(data.used / 10000).toLocaleString()}만
          </p>
        </div>
        <div className="text-center bg-green-50 rounded-lg p-2">
          <p className="text-xs text-gray-500">잔여 예산</p>
          <p className={`text-sm font-bold ${isOver ? 'text-red-600' : 'text-green-700'}`}>
            {isOver ? '초과' : `₩${(data.remaining / 10000).toLocaleString()}만`}
          </p>
        </div>
      </div>

      {/* 예산 소진률 바 */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
          <span>소진률</span>
          <span className={`font-semibold ${isOver ? 'text-red-600' : ''}`}>{data.usageRate}%</span>
        </div>
        <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${Math.min(100, data.usageRate)}%`,
              backgroundColor: barColor,
            }}
          />
        </div>
      </div>

      {/* 월별 소진 바차트 */}
      <ResponsiveContainer width="100%" height={120}>
        <BarChart data={data.monthly} margin={{ top: 2, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="label" tick={{ fontSize: 10 }} />
          <YAxis tickFormatter={fmt} tick={{ fontSize: 10 }} width={52} />
          <Tooltip
            formatter={(v: any) => [`₩${Number(v).toLocaleString()}`, '소진 금액']}
            labelStyle={{ fontSize: 11 }}
          />
          <Bar dataKey="amount" radius={[2, 2, 0, 0]}>
            {data.monthly.map((entry, i) => (
              <Cell key={i} fill={entry.amount > 0 ? barColor : '#e5e7eb'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
