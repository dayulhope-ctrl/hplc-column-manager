'use client';

import { LucideIcon } from 'lucide-react';

interface StatsCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  description?: string;
  color?: 'blue' | 'green' | 'amber' | 'red' | 'purple';
}

const colorMap = {
  blue: 'bg-blue-100 text-blue-600',
  green: 'bg-green-100 text-green-600',
  amber: 'bg-amber-100 text-amber-600',
  red: 'bg-red-100 text-red-600',
  purple: 'bg-purple-100 text-purple-600',
};

export default function StatsCard({ icon: Icon, label, value, description, color = 'blue' }: StatsCardProps) {
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
      <div className="flex items-start justify-between mb-2">
        <p className="text-xs sm:text-sm text-gray-600 font-medium">{label}</p>
        <div className={`p-2 rounded-lg ${colorMap[color]}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <p className="text-xl sm:text-2xl font-bold text-gray-900">{value}</p>
      {description && (
        <p className="text-xs text-gray-500 mt-1">{description}</p>
      )}
    </div>
  );
}
