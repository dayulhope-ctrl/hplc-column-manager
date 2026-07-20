import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// 칼럼 마스터: 시험품목/항목 매핑 조회
//   ?product=검색어   → 시험품목 부분일치
//   ?test_item=검색어 → 시험항목 부분일치
//   ?model_id=uuid    → 특정 칼럼의 품목/항목
//   (없으면 전체)
export async function GET(req: NextRequest) {
  try {
    const sb = createServerClient();
    const { searchParams } = new URL(req.url);
    const product = searchParams.get('product');
    const testItem = searchParams.get('test_item');
    const modelId = searchParams.get('model_id');

    let query = sb
      .from('column_test_mappings')
      .select('*, column_models(model_name, cat_no, size, kep_code, total_stock, purchase_status, is_draft)')
      .order('product_name', { ascending: true });

    if (product) query = query.ilike('product_name', `%${product}%`);
    if (testItem) query = query.ilike('test_item', `%${testItem}%`);
    if (modelId) query = query.eq('model_id', modelId);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ mappings: data || [] });
  } catch (e: any) {
    console.error('test-mappings GET error:', e);
    return NextResponse.json({ error: '조회 실패' }, { status: 500 });
  }
}
