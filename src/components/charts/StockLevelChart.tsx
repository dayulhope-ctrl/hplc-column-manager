'use client';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';

interface Props {
  data: { name: string; stock: number }[];
}

const COLORS = ['#3b82f6', '#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd',
  '#93c5fd', '#60a5fa', '#818cf8', '#7c3aed', '#4f46e5'];

export default function StockLevelChart({ data }: Props) {
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">재고 현황 Top 10</h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 11 }} />
          <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={140} />
          <Tooltip
            formatter={(value: any) => [value, '재고 수량']}
            labelStyle={{ fontSize: 12 }}
          />
          <Bar dataKey="stock" radius={[0, 3, 3, 0]}>
            {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
