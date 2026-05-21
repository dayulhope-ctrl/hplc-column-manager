import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';
import { buildXlsxResponse } from '@/lib/excel';

export async function GET() {
  try {
    await requireAdmin();
    const sb = createServerClient();

    const { data, error } = await sb
      .from('column_models')
      .select('*')
      .order('model_name', { ascending: true });
    if (error) throw error;

    const header = ['모델명', 'Cat. No', 'KEP 코드', '사이즈', '입자크기(µm)', '재고 수량', '최소 안전재고', '단가(원)', '구매 상태', '발주 수량', '발주일', '등록일'];
    const rows = (data || []).map(c => [
      c.model_name, c.cat_no, c.kep_code || '', c.size || '', c.particle_size || '',
      c.total_stock, c.min_safety_stock, c.unit_price,
      c.purchase_status || '', c.purchase_quantity || '', c.order_date || '',
      c.registration_date || '',
    ]);

    return buildXlsxResponse([[header, ...rows]], ['재고현황'], '재고현황');
  } catch (e: any) {
    if (e.message?.includes('로그인') || e.message?.includes('관리자')) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    return NextResponse.json({ error: '내보내기 실패' }, { status: 500 });
  }
}
