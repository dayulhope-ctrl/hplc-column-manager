'use client';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

interface Props {
  data: { label: string; quantity: number; amount: number }[];
}

const formatAmount = (v: number) => `₩${(v / 10000).toFixed(0)}만`;

export default function MonthlyPurchaseChart({ data }: Props) {
  const year = new Date().getFullYear();
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">{year}년 월별 입고 금액 추이</h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis tickFormatter={formatAmount} tick={{ fontSize: 11 }} width={60} />
          <Tooltip
            formatter={(value: any, name: any) =>
              name === 'amount' ? [`₩${Number(value).toLocaleString()}`, '입고 금액'] : [value, '입고 수량']
            }
            labelStyle={{ fontSize: 12 }}
          />
          <Legend
            formatter={name => name === 'amount' ? '입고 금액' : '입고 수량'}
            wrapperStyle={{ fontSize: 12 }}
          />
          <Bar dataKey="amount" fill="#3b82f6" radius={[3, 3, 0, 0]} name="amount" />
          <Bar dataKey="quantity" fill="#93c5fd" radius={[3, 3, 0, 0]} name="quantity" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
