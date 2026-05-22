import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdmin();
    const sb = createServerClient();
    const body = await req.json();

    const allowedFields = ['status', 'column_code', 'start_date', 'user_name', 'product_name', 'test_item',
      'last_used_date', 'replacement_reason', 'usage_reason', 'usage_count', 'notes'];
    const updates: Record<string, any> = {};
    for (const key of allowedFields) {
      if (key in body) updates[key] = body[key];
    }

    const { data, error } = await sb
      .from('individual_columns')
      .update(updates)
      .eq('id', params.id)
      .select()
      .single();

    if (error) throw error;

    await sb.from('activity_logs').insert({
      actor: session.username,
      actor_type: 'admin',
      action: 'update_individual_column',
      target_type: 'individual_column',
      target_id: params.id,
    });

    return NextResponse.json({ record: data });
  } catch (e: any) {
    if (e.message?.includes('로그인') || e.message?.includes('관리자')) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    return NextResponse.json({ error: '수정 실패' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdmin();
    const sb = createServerClient();

    const { error } = await sb.from('individual_columns').delete().eq('id', params.id);
    if (error) throw error;

    await sb.from('activity_logs').insert({
      actor: session.username,
      actor_type: 'admin',
      action: 'delete_individual_column',
      target_type: 'individual_column',
      target_id: params.id,
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e.message?.includes('로그인') || e.message?.includes('관리자')) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    return NextResponse.json({ error: '삭제 실패' }, { status: 500 });
  }
}
