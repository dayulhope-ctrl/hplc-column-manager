import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';
import { buildXlsxResponse } from '@/lib/excel';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    const sb = createServerClient();

    const { data, error } = await sb
      .from('purchase_requests')
      .select('*, column_models(model_name, cat_no, kep_code, size, unit_price)')
      .eq('status', 'ordered')
      .order('ordered_at', { ascending: false });

    if (error) throw error;

    const modelIds = (data || []).map((r: any) => r.column_model_id);
    const { data: usageData } = await sb
      .from('individual_columns')
      .select('model_id, product_name')
      .in('model_id', modelIds)
      .not('product_name', 'is', null)
      .neq('product_name', '');

    const usageMap: Record<string, string[]> = {};
    (usageData || []).forEach((r: any) => {
      if (!usageMap[r.model_id]) usageMap[r.model_id] = [];
      if (!usageMap[r.model_id].includes(r.product_name))
        usageMap[r.model_id].push(r.product_name);
    });

    const rows = (data || []).map(r => {
      const col = r.column_models as any;
      const unitPrice = col?.unit_price ?? 0;
      const total = unitPrice * r.quantity;
      const products = usageMap[r.column_model_id];
      const usage = products?.length ? products.join(', ') : (r.reason ?? '');
      return [
        col?.model_name ?? '',
        col?.cat_no ?? '',
        col?.kep_code ?? '',
        col?.size ?? '',
        r.quantity,
        unitPrice,
        total,
        usage,
      ];
    });

    const totalQty = rows.reduce((s, r) => s + (r[4] as number), 0);
    const totalAmt = rows.reduce((s, r) => s + (r[6] as number), 0);
    const totalRow = ['합계', '', '', '', totalQty, '', totalAmt, ''];

    const header = ['모델명', 'Cat. No', 'KEP 코드', '사이즈', '수량', '단가(원)', '예상총액(원)', '구매용도'];

    return buildXlsxResponse([[header, ...rows, totalRow]], ['입고대기'], '입고대기목록');
  } catch (e: any) {
    if (e.message?.includes('로그인') || e.message?.includes('관리자')) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    return NextResponse.json({ error: '내보내기 실패' }, { status: 500 });
  }
}
