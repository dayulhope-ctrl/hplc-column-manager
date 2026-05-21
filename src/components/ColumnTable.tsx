'use client';

import { useState } from 'react';
import { ColumnModel } from '@/types';
import { ShoppingCart, Edit, Trash2, AlertCircle } from 'lucide-react';

interface ColumnTableProps {
  columns: ColumnModel[];
  isAdmin?: boolean;
  onRequestPurchase?: (column: ColumnModel) => void;
  onEdit?: (column: ColumnModel) => void;
  onDelete?: (column: ColumnModel) => void;
  onRowClick?: (column: ColumnModel) => void;
}

export default function ColumnTable({ columns, isAdmin, onRequestPurchase, onEdit, onDelete, onRowClick }: ColumnTableProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3 text-left">모델명</th>
              <th className="px-4 py-3 text-left">Cat. No</th>
              <th className="px-4 py-3 text-left hidden md:table-cell">사이즈</th>
              <th className="px-4 py-3 text-center hidden lg:table-cell">입자</th>
              <th className="px-4 py-3 text-center">재고</th>
              <th className="px-4 py-3 text-left hidden md:table-cell">KEP</th>
              <th className="px-4 py-3 text-right hidden lg:table-cell">단가</th>
              <th className="px-4 py-3 text-center">상태</th>
              <th className="px-4 py-3 text-center">액션</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {columns.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-gray-400">
                  데이터가 없습니다
                </td>
              </tr>
            ) : (
              columns.map((col) => {
                const isLowStock = col.total_stock <= col.min_safety_stock;
                const isOutOfStock = col.total_stock === 0;
                return (
                  <tr key={col.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      <div className="flex items-center gap-2">
                        {isOutOfStock && (
                          <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-500" />
                        )}
                        {onRowClick ? (
                          <button
                            onClick={() => onRowClick(col)}
                            className="truncate max-w-[200px] text-left text-blue-700 hover:underline font-medium"
                          >
                            {col.model_name}
                          </button>
                        ) : (
                          <span className="truncate max-w-[200px]">{col.model_name}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 font-mono text-xs">{col.cat_no}</td>
                    <td className="px-4 py-3 text-gray-600 hidden md:table-cell">{col.size || '-'}</td>
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
                        <span className="inline-flex px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700">
                          발주됨
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
    </div>
  );
}
