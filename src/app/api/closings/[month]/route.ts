import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';

export async function GET(req: NextRequest, { params }: { params: { month: string } }) {
  try {
    await requireAdmin();
    const sb = createServerClient();

    const { data, error } = await sb
      .from('monthly_closings')
      .select('*')
      .eq('month', params.month)
      .single();

    if (error) return NextResponse.json({ error: '결산 내역을 찾을 수 없습니다' }, { status: 404 });
    return NextResponse.json({ closing: data });
  } catch (e: any) {
    if (e.message?.includes('로그인') || e.message?.includes('관리자')) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    return NextResponse.json({ error: '조회 실패' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { month: string } }) {
  try {
    const admin = await requireAdmin();
    const sb = createServerClient();

    const { error } = await sb.from('monthly_closings').delete().eq('month', params.month);
    if (error) throw error;

    await sb.from('activity_logs').insert({
      actor: admin.username,
      actor_type: 'admin',
      action: 'delete_closing',
      target_type: 'monthly_closing',
      details: { month: params.month },
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e.message?.includes('관리자')) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    return NextResponse.json({ error: '삭제 실패' }, { status: 500 });
  }
}
