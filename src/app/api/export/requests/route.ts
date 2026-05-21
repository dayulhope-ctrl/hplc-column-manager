import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';
import { buildXlsxResponse } from '@/lib/excel';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    const sb = createServerClient();
    const { searchParams } = new URL(req.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    let query = sb
      .from('purchase_requests')
      .select('*, column_models(model_name, cat_no)')
      .order('created_at', { ascending: false });
    if (from) query = query.gte('created_at', from);
    if (to) query = query.lte('created_at', to + 'T23:59:59');

    const { data, error } = await query;
    if (error) throw error;

    const STATUS_MAP: Record<string, string> = {
      pending: '대기중', approved: '승인됨', rejected: '거부됨', ordered: '발주 완료', received: '입고 완료',
    };
    const URGENCY_MAP: Record<string, string> = {
      low: '낮음', normal: '보통', high: '높음', urgent: '긴급',
    };

    const header = ['요청일', '요청자', '부서', '모델명', 'Cat. No', '수량', '긴급도', '상태', '사유', '검토자', '검토일', '검토메모'];
    const rows = (data || []).map(r => [
      new Date(r.created_at).toLocaleDateString('ko-KR'),
      r.requested_by, r.department || '',
      (r as any).column_models?.model_name || '', (r as any).column_models?.cat_no || '',
      r.quantity, URGENCY_MAP[r.urgency] || r.urgency, STATUS_MAP[r.status] || r.status,
      r.reason || '', r.reviewed_by || '',
      r.reviewed_at ? new Date(r.reviewed_at).toLocaleDateString('ko-KR') : '',
      r.review_notes || '',
    ]);

    return buildXlsxResponse([[header, ...rows]], ['구매요청내역'], '구매요청내역');
  } catch (e: any) {
    if (e.message?.includes('로그인') || e.message?.includes('관리자')) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    return NextResponse.json({ error: '내보내기 실패' }, { status: 500 });
  }
}
