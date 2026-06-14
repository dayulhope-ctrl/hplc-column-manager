import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';

// 칼럼 수정 (관리자)
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requireAdmin();
    const body = await req.json();
    const sb = createServerClient();

    const updateData: any = {};
    const allowedFields = [
      'model_name', 'cat_no', 'registration_date', 'size', 'particle_size',
      'total_stock', 'total_usage_count', 'min_safety_stock', 'unit_price',
      'kep_code', 'purchase_required', 'purchase_status', 'purchase_quantity',
      'order_date', 'notes', 'products_used'
    ];
    for (const key of allowedFields) {
      if (key in body) updateData[key] = body[key];
    }

    const { data, error } = await sb
      .from('column_models')
      .update(updateData)
      .eq('id', params.id)
      .select()
      .single();

    if (error) throw error;

    await sb.from('activity_logs').insert({
      actor: admin.username,
      actor_type: 'admin',
      action: 'update_column',
      target_type: 'column_model',
      target_id: params.id,
      details: updateData,
    });

    return NextResponse.json({ column: data });
  } catch (e: any) {
    if (e.message?.includes('관리자')) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    console.error('Column PATCH error:', e);
    return NextResponse.json({ error: '수정 실패' }, { status: 500 });
  }
}

// 칼럼 숨김 처리 (대시보드에서 삭제 = is_hidden 플래그, 데이터는 보존)
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requireAdmin();
    const sb = createServerClient();

    // 1. 칼럼 숨김 + 구매 관련 상태 초기화 (구매 필요 없음으로 처리)
    const { error } = await sb
      .from('column_models')
      .update({
        is_hidden: true,
        purchase_status: null,
        purchase_required: false,
        purchase_quantity: null,
        order_date: null,
      })
      .eq('id', params.id);

    if (error) throw error;

    // 2. 이 칼럼의 pending/approved 구매요청 → 자동 취소
    await sb
      .from('purchase_requests')
      .update({ status: 'rejected', review_notes: '칼럼 숨김 처리로 자동 취소' })
      .eq('column_model_id', params.id)
      .in('status', ['pending', 'approved']);

    await sb.from('activity_logs').insert({
      actor: admin.username,
      actor_type: 'admin',
      action: 'hide_column',
      target_type: 'column_model',
      target_id: params.id,
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e.message?.includes('관리자')) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    console.error('Column DELETE error:', e);
    return NextResponse.json({ error: '처리 실패' }, { status: 500 });
  }
}
