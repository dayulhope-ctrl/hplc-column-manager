import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, requireAuth } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  try {
    const sb = createServerClient();
    const { searchParams } = new URL(req.url);
    const modelId = searchParams.get('model_id');

    // column_models.products_used 에서 사용 제품 목록 조회
    let query = sb
      .from('column_models')
      .select('id, products_used')
      .not('products_used', 'is', null);

    if (modelId) query = query.eq('id', modelId);

    const { data, error } = await query;
    if (error) throw error;

    // AdminClient/DashboardClient 의 usageMap 빌더와 호환되는 형태로 평탄화
    const records: { id: string; column_model_id: string; product_name: string }[] = [];
    for (const row of data || []) {
      const products: string[] = Array.isArray(row.products_used) ? row.products_used : [];
      for (const name of products) {
        if (name) records.push({ id: row.id, column_model_id: row.id, product_name: name });
      }
    }

    return NextResponse.json({ records });
  } catch (e: any) {
    if (e.message?.includes('로그인') || e.message?.includes('관리자')) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    console.error('usage_history GET error:', e);
    return NextResponse.json({ records: [], error: e.message }, { status: 200 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAuth();
    const sb = createServerClient();
    const body = await req.json();

    const { data, error } = await sb
      .from('usage_history')
      .insert(body)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ record: data }, { status: 201 });
  } catch (e: any) {
    if (e.message?.includes('로그인') || e.message?.includes('관리자')) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    return NextResponse.json({ error: '추가 실패: ' + e.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await requireAdmin();
    const sb = createServerClient();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id 필요' }, { status: 400 });

    const { error } = await sb.from('usage_history').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: '삭제 실패' }, { status: 500 });
  }
}
