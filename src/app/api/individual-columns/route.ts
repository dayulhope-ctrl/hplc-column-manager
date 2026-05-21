import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  try {
    const sb = createServerClient();
    const { searchParams } = new URL(req.url);
    const modelId = searchParams.get('model_id');
    const status = searchParams.get('status');

    let query = sb
      .from('individual_columns')
      .select('*, column_models(model_name, cat_no)')
      .order('created_at', { ascending: false });

    if (modelId) query = query.eq('model_id', modelId);
    if (status && status !== 'all') query = query.eq('status', status);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ records: data || [] });
  } catch (e: any) {
    if (e.message?.includes('로그인') || e.message?.includes('관리자')) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    return NextResponse.json({ error: '조회 실패' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAdmin();
    const sb = createServerClient();
    const body = await req.json();

    const { model_id, column_code, status, start_date, user_name, product_name, test_item, usage_reason, notes } = body;
    if (!model_id || !status) {
      return NextResponse.json({ error: '필수 항목을 입력해주세요' }, { status: 400 });
    }

    const { data, error } = await sb
      .from('individual_columns')
      .insert({
        model_id,
        column_code: column_code || null,
        status,
        start_date: start_date || null,
        user_name: user_name || null,
        product_name: product_name || null,
        test_item: test_item || null,
        usage_reason: usage_reason || null,
        notes: notes || null,
        usage_count: 0,
      })
      .select()
      .single();

    if (error) throw error;

    // 이력 추가 시 재고 1개 차감
    const { data: colData } = await sb
      .from('column_models')
      .select('total_stock')
      .eq('id', model_id)
      .single();
    if (colData && colData.total_stock > 0) {
      await sb
        .from('column_models')
        .update({ total_stock: colData.total_stock - 1 })
        .eq('id', model_id);
    }

    await sb.from('activity_logs').insert({
      actor: session.username,
      actor_type: 'admin',
      action: 'create_individual_column',
      target_type: 'individual_column',
      target_id: data.id,
    });

    return NextResponse.json({ record: data }, { status: 201 });
  } catch (e: any) {
    if (e.message?.includes('로그인') || e.message?.includes('관리자')) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    return NextResponse.json({ error: '추가 실패' }, { status: 500 });
  }
}
