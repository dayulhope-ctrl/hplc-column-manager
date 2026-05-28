'use client';

import { useRouter } from 'next/navigation';
import { Package, ShoppingCart, Lock } from 'lucide-react';

const CARDS = [
  {
    icon: Package,
    title: '재고 조회',
    desc: '칼럼별 현재 재고 현황을 확인합니다',
    href: '/stock',
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
    border: 'border-blue-100 hover:border-blue-300',
    btn: 'bg-blue-600 hover:bg-blue-700',
  },
  {
    icon: ShoppingCart,
    title: '구매 요청',
    desc: '필요한 칼럼 구매를 신청합니다',
    href: '/request',
    iconBg: 'bg-green-100',
    iconColor: 'text-green-600',
    border: 'border-green-100 hover:border-green-300',
    btn: 'bg-green-600 hover:bg-green-700',
  },
  {
    icon: Lock,
    title: '관리자 모드',
    desc: '관리자 전용 로그인이 필요합니다',
    href: '/login',
    iconBg: 'bg-gray-100',
    iconColor: 'text-gray-600',
    border: 'border-gray-200 hover:border-gray-400',
    btn: 'bg-gray-700 hover:bg-gray-800',
  },
];

export default function LandingPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 flex flex-col items-center justify-center px-4 py-12">
      {/* 헤더 */}
      <div className="text-center mb-12">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-5 shadow-lg">
          <Package className="w-9 h-9 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">품질관리팀 칼럼 관리 시스템</h1>
        <p className="text-gray-500 text-base">HPLC 칼럼 재고 및 구매 관리 플랫폼</p>
      </div>

      {/* 카드 3개 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-3xl">
        {CARDS.map(({ icon: Icon, title, desc, href, iconBg, iconColor, border, btn }) => (
          <button
            key={href}
            onClick={() => router.push(href)}
            className={`bg-white rounded-2xl border-2 ${border} shadow-sm hover:shadow-md transition-all duration-200 p-8 flex flex-col items-center text-center group cursor-pointer`}
          >
            <div className={`w-16 h-16 rounded-2xl ${iconBg} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-200`}>
              <Icon className={`w-8 h-8 ${iconColor}`} />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">{title}</h2>
            <p className="text-sm text-gray-500 mb-6 leading-relaxed">{desc}</p>
            <span className={`px-5 py-2 ${btn} text-white text-sm font-medium rounded-xl transition-colors`}>
              {title} →
            </span>
          </button>
        ))}
      </div>

      <p className="mt-10 text-xs text-gray-400">품질관리팀 내부 전용 시스템</p>
    </div>
  );
}
