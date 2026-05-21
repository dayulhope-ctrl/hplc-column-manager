import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, requireAuth } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';

export async function GET() {
  try {
    await requireAuth();
    const sb = createServerClient();

    const { data, error } = await sb
      .from('monthly_closings')
      .select('*')
      .order('month', { ascending: false })
      .limit(24);

    if (error) throw error;
    return NextResponse.json({ closings: data || [] });
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
    const { month, notes } = await req.json();

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ error: '월 형식이 올바르지 않습니다 (YYYY-MM)' }, { status: 400 });
    }

    // 이미 결산된 월인지 확인
    const { data: existing } = await sb.from('monthly_closings').select('id').eq('month', month).single();
    if (existing) {
      return NextResponse.json({ error: '이미 결산된 월입니다' }, { status: 409 });
    }

    // 해당 월 입고 기록 집계
    const startDate = `${month}-01`;
    const endDate = new Date(parseInt(month.slice(0, 4)), parseInt(month.slice(5, 7)), 0)
      .toISOString().slice(0, 10);

    const { data: records, error: recErr } = await sb
      .from('receiving_records')
      .select('*')
      .gte('receiving_date', startDate)
      .lte('receiving_date', endDate);

    if (recErr) throw recErr;

    const totalQuantity = (records || []).reduce((s, r) => s + (r.quantity || 0), 0);
    const totalPrice = (records || []).reduce((s, r) => s + (r.total_price || 0), 0);

    const { data: closing, error: insErr } = await sb
      .from('monthly_closings')
      .insert({
        month,
        closing_date: new Date().toISOString().slice(0, 10),
        total_quantity: totalQuantity,
        total_price: totalPrice,
        records: records || [],
        closed_by: session.username,
        notes: notes || null,
      })
      .select()
      .single();

    if (insErr) throw insErr;

    await sb.from('activity_logs').insert({
      actor: session.username,
      actor_type: 'admin',
      action: 'monthly_closing',
      target_type: 'monthly_closing',
      target_id: closing.id,
    });

    return NextResponse.json({ closing }, { status: 201 });
  } catch (e: any) {
    if (e.message?.includes('로그인') || e.message?.includes('관리자')) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    if (e.message?.includes('이미 결산')) {
      return NextResponse.json({ error: e.message }, { status: 409 });
    }
    return NextResponse.json({ error: '결산 실패' }, { status: 500 });
  }
}
