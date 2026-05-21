'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FlaskConical, Shield, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function AdminLoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [adminId, setAdminId] = useState('');
  const [adminPw, setAdminPw] = useState('');

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!adminId.trim() || !adminPw) {
      setError('ID와 비밀번호를 입력해주세요');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: adminId.trim(), password: adminPw }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '로그인 실패');
      router.push('/admin');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* 헤더 */}
          <div className="flex items-center justify-center mb-6">
            <div className="bg-gray-800 text-white p-3 rounded-xl">
              <FlaskConical className="w-8 h-8" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-center text-gray-900 mb-1">
            관리자 로그인
          </h1>
          <p className="text-sm text-center text-gray-500 mb-6">
            HPLC 칼럼 관리 시스템
          </p>

          {/* 관리자 배지 */}
          <div className="flex items-center justify-center gap-2 mb-6 py-2 px-4 bg-amber-50 border border-amber-200 rounded-lg">
            <Shield className="w-4 h-4 text-amber-600" />
            <span className="text-sm font-medium text-amber-700">관리자 전용 페이지</span>
          </div>

          {/* 로그인 폼 */}
          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                관리자 ID
              </label>
              <input
                type="text"
                value={adminId}
                onChange={(e) => setAdminId(e.target.value)}
                placeholder="관리자 ID 입력"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                비밀번호
              </label>
              <input
                type="password"
                value={adminPw}
                onChange={(e) => setAdminPw(e.target.value)}
                placeholder="비밀번호 입력"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent"
              />
            </div>
            {error && (
              <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gray-800 text-white py-3 rounded-lg font-medium hover:bg-gray-900 disabled:opacity-50 transition-colors"
            >
              {loading ? '로그인 중...' : '관리자 로그인'}
            </button>
            <p className="text-xs text-gray-400 text-center">
              세션은 30분 후 자동 만료됩니다
            </p>
          </form>
        </div>

        {/* 대시보드로 돌아가기 */}
        <Link
          href="/dashboard"
          className="flex items-center justify-center gap-2 mt-4 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          팀원 대시보드로 돌아가기
        </Link>

        <p className="text-center text-xs text-gray-400 mt-3">
          © 2026 HPLC Column Manager
        </p>
      </div>
    </div>
  );
}
