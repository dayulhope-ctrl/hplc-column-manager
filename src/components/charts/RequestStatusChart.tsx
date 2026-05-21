'use client';

import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

interface Props {
  data: { name: string; value: number; key: string }[];
}

const COLORS: Record<string, string> = {
  pending: '#f59e0b',
  approved: '#3b82f6',
  ordered: '#8b5cf6',
  received: '#10b981',
  rejected: '#ef4444',
};

export default function RequestStatusChart({ data }: Props) {
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">구매 요청 상태 분포</h3>
      {data.length === 0 ? (
        <div className="h-[220px] flex items-center justify-center text-gray-400 text-sm">데이터 없음</div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie data={data} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={3}>
              {data.map((entry, i) => (
                <Cell key={i} fill={COLORS[entry.key] || '#94a3b8'} />
              ))}
            </Pie>
            <Tooltip formatter={(value: any, name: any) => [String(value) + '건', String(name)]} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
