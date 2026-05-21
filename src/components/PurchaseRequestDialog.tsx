'use client';

import { useState } from 'react';
import { ColumnModel } from '@/types';
import { X } from 'lucide-react';

interface PurchaseRequestDialogProps {
  column: ColumnModel;
  onClose: () => void;
  onSubmit: (data: { quantity: number; reason: string; urgency: string }) => Promise<void>;
}

export default function PurchaseRequestDialog({ column, onClose, onSubmit }: PurchaseRequestDialogProps) {
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState('');
  const [urgency, setUrgency] = useState('normal');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (quantity < 1) {
      setError('수량은 1 이상이어야 합니다');
      return;
    }
    setLoading(true);
    try {
      await onSubmit({ quantity, reason, urgency });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-lg font-bold text-gray-900">구매 요청</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* 칼럼 정보 */}
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="font-semibold text-gray-900">{column.model_name}</p>
            <div className="text-xs text-gray-600 mt-1 space-y-0.5">
              <p>Cat. No: <span className="font-mono">{column.cat_no}</span></p>
              <p>사이즈: {column.size || '-'}</p>
              <p>현재 재고: <span className="font-bold">{column.total_stock}개</span></p>
              <p>단가: ₩{column.unit_price.toLocaleString()}</p>
            </div>
          </div>

          {/* 수량 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              요청 수량 <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">
              예상 총액: ₩{(column.unit_price * quantity).toLocaleString()}
            </p>
          </div>

          {/* 긴급도 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">긴급도</label>
            <select
              value={urgency}
              onChange={(e) => setUrgency(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="low">낮음</option>
              <option value="normal">보통</option>
              <option value="high">높음</option>
              <option value="urgent">긴급</option>
            </select>
          </div>

          {/* 요청 사유 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              요청 사유
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="예: 신제품 분석에 필요"
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-2 rounded-lg">{error}</div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? '제출 중...' : '요청 제출'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
