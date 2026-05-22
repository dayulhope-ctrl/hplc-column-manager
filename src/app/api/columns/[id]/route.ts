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

// 칼럼 삭제 (관리자)
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requireAdmin();
    const sb = createServerClient();

    const { error } = await sb
      .from('column_models')
      .delete()
      .eq('id', params.id);

    if (error) throw error;

    await sb.from('activity_logs').insert({
      actor: admin.username,
      actor_type: 'admin',
      action: 'delete_column',
      target_type: 'column_model',
      target_id: params.id,
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e.message?.includes('관리자')) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    console.error('Column DELETE error:', e);
    return NextResponse.json({ error: '삭제 실패' }, { status: 500 });
  }
}
