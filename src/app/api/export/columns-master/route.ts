import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { buildXlsxResponse } from '@/lib/excel';

export async function GET() {
  try {
    const sb = createServerClient();

    const { data, error } = await sb
      .from('column_models')
      .select('*')
      .eq('is_draft', false)
      .eq('is_hidden', false)
      .order('model_name', { ascending: true });

    if (error) throw error;

    const headers = [
      '모델명', 'Cat. No', 'KEP 코드', '사이즈', '입자크기 (µm)',
      '재고 수량', '최소 안전재고', '단가 (원)',
      '구매 상태', '발주 수량', '발주일', '등록일',
      '사용 품목', '메모',
    ];

    const rows = (data || []).map(c => [
      c.model_name,
      c.cat_no,
      c.kep_code ?? '-',
      c.size ?? '-',
      c.particle_size ?? '-',
      c.total_stock,
      c.min_safety_stock,
      c.unit_price,
      c.purchase_status ?? '-',
      c.purchase_quantity ?? '-',
      c.order_date ?? '-',
      c.registration_date ?? '-',
      Array.isArray(c.products_used) && c.products_used.length > 0
        ? c.products_used.join(', ')
        : '-',
      c.notes ?? '-',
    ]);

    return buildXlsxResponse([[headers, ...rows]], ['칼럼마스터'], '칼럼마스터');
  } catch (e: any) {
    console.error('columns-master export error:', e);
    return NextResponse.json({ error: '내보내기 실패: ' + e.message }, { status: 500 });
  }
}
