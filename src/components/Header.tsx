'use client';

import { useRouter } from 'next/navigation';
import { FlaskConical, LogOut, User, Shield } from 'lucide-react';

interface HeaderProps {
  userName: string;
  isAdmin?: boolean;
}

export default function Header({ userName, isAdmin = false }: HeaderProps) {
  const router = useRouter();

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
    router.refresh();
  };

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 text-white p-2 rounded-lg">
            <FlaskConical className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-gray-900 text-base sm:text-lg leading-tight">
              HPLC 칼럼 관리
            </h1>
            <p className="text-xs text-gray-500 hidden sm:block">재고 및 사용 이력 관리 시스템</p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium ${
            isAdmin ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
          }`}>
            {isAdmin ? <Shield className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
            <span className="truncate max-w-[100px]">{userName}</span>
            {isAdmin && <span className="hidden sm:inline">관리자</span>}
          </div>
          <button
            onClick={handleLogout}
            className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="로그아웃"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
