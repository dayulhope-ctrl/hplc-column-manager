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
      .from('receiving_records')
      .select('*')
      .order('receiving_date', { ascending: false });
    if (from) query = query.gte('receiving_date', from);
    if (to) query = query.lte('receiving_date', to);

    const { data, error } = await query;
    if (error) throw error;

    const header = ['입고일', '모델명', 'Cat. No', 'KEP 코드', '사이즈', '입자크기(µm)', '수량', '단가(원)', '총액(원)', '처리자', '비고'];
    const rows = (data || []).map(r => [
      r.receiving_date, r.model_name, r.cat_no, r.kep_code || '',
      r.size || '', r.particle_size || '', r.quantity,
      r.unit_price || '', r.total_price || '',
      r.received_by || '', r.notes || '',
    ]);

    return buildXlsxResponse([[header, ...rows]], ['입고기록'], '입고기록');
  } catch (e: any) {
    if (e.message?.includes('로그인') || e.message?.includes('관리자')) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    return NextResponse.json({ error: '내보내기 실패' }, { status: 500 });
  }
}
