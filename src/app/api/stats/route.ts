import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function GET() {
  try {
    const sb = createServerClient();

    const { data: columns, error } = await sb.from('column_models').select('*').eq('is_draft', false);
    if (error) throw error;

    const { count: pendingCount } = await sb
      .from('purchase_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    const stats = {
      totalModels: columns?.length || 0,
      totalStock: columns?.reduce((sum, c) => sum + (c.total_stock || 0), 0) || 0,
      purchaseRequiredCount: columns?.filter(c => c.total_stock === 0 && !c.purchase_status).length || 0,
      approvedRequestCount: columns?.filter(c => c.purchase_status === '구매 승인').length || 0,
      orderCompletedCount: columns?.filter(c => c.purchase_status === '발주 완료').length || 0,
      totalValue: columns?.reduce((sum, c) => sum + (c.unit_price * c.total_stock), 0) || 0,
      pendingRequestsCount: pendingCount || 0,
      lowStockCount: columns?.filter(c => c.total_stock > 0 && c.total_stock <= c.min_safety_stock).length || 0,
    };

    return NextResponse.json({ stats });
  } catch (e: any) {
    if (e.message?.includes('로그인')) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    return NextResponse.json({ error: '통계 조회 실패' }, { status: 500 });
  }
}
