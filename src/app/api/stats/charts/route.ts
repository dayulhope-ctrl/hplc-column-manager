import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';

const ANNUAL_BUDGET = 80_000_000; // 연간 예산 8천만원

export async function GET() {
  try {
    await requireAdmin();
    const sb = createServerClient();

    const thisYear = new Date().getFullYear();

    // 올해 1월~12월 입고 금액 집계
    const { data: receivings } = await sb
      .from('receiving_records')
      .select('receiving_date, quantity, total_price')
      .gte('receiving_date', `${thisYear}-01-01`)
      .lte('receiving_date', `${thisYear}-12-31`)
      .order('receiving_date', { ascending: true });

    // 월별 집계 배열 (1~12월 순서 보장)
    const monthlyAmounts = Array.from({ length: 12 }, () => ({ quantity: 0, amount: 0 }));
    (receivings || []).forEach(r => {
      const month = r.receiving_date ? parseInt(r.receiving_date.slice(5, 7), 10) - 1 : -1;
      if (month >= 0 && month < 12) {
        monthlyAmounts[month].quantity += r.quantity || 0;
        monthlyAmounts[month].amount += r.total_price || 0;
      }
    });
    const monthlyData = monthlyAmounts.map((m, i) => ({
      label: `${i + 1}월`,
      quantity: m.quantity,
      amount: m.amount,
    }));

    // 올해 예산 소진 현황
    const usedBudget = monthlyAmounts.reduce((s, m) => s + m.amount, 0);
    const remainingBudget = Math.max(0, ANNUAL_BUDGET - usedBudget);
    const usageRate = Math.min(100, Math.round((usedBudget / ANNUAL_BUDGET) * 100));

    const budgetData = {
      annual: ANNUAL_BUDGET,
      used: usedBudget,
      remaining: remainingBudget,
      usageRate,
      monthly: monthlyData, // 동일 데이터 재사용 (1~12월)
    };

    return NextResponse.json({ monthlyData, budgetData });
  } catch (e: any) {
    if (e.message?.includes('로그인') || e.message?.includes('관리자')) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    return NextResponse.json({ error: '차트 데이터 조회 실패' }, { status: 500 });
  }
}
