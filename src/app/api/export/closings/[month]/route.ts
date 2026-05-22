import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';
import { buildXlsxResponse } from '@/lib/excel';

export async function GET(req: NextRequest, { params }: { params: { month: string } }) {
  try {
    await requireAdmin();
    const sb = createServerClient();
    const { month } = params;

    const { data, error } = await sb
      .from('monthly_closings')
      .select('*')
      .eq('month', month)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: '마감 데이터를 찾을 수 없습니다' }, { status: 404 });
    }

    const records: any[] = Array.isArray(data.records) ? data.records : [];

    const header = ['발주일', 'KEP 코드', '모델명', 'Cat. No', '사이즈', '입자크기(µm)', '구매수량', '단가(원)', '입고금액(원)', '입고일'];
    const rows = records.map((r: any) => [
      r.order_date || '',
      r.kep_code || '',
      r.model_name || '',
      r.cat_no || '',
      r.size || '',
      r.particle_size || '',
      r.quantity,
      r.unit_price || 0,
      r.total_price || 0,
      r.receiving_date || '',
    ]);

    const totalQty = records.reduce((s, r) => s + (r.quantity || 0), 0);
    const totalAmt = records.reduce((s, r) => s + (r.total_price || 0), 0);
    const totalRow = ['합계', '', '', '', '', '', totalQty, '', totalAmt, ''];

    return buildXlsxResponse([[header, ...rows, totalRow]], [month], `마감자료_${month}`);
  } catch (e: any) {
    if (e.message?.includes('로그인') || e.message?.includes('관리자')) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    return NextResponse.json({ error: '내보내기 실패' }, { status: 500 });
  }
}
