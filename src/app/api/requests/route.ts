import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';

// 구매 요청 목록 (게스트/팀원/관리자 모두 조회 가능)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status'); // pending, approved, all
    
    const sb = createServerClient();
    let query = sb
      .from('purchase_requests')
      .select('*, column_models(*)')
      .order('created_at', { ascending: false });

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ requests: data || [] });
  } catch (e: any) {
    if (e.message?.includes('로그인')) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    console.error('Requests GET error:', e);
    return NextResponse.json({ error: '조회 실패' }, { status: 500 });
  }
}

// 구매 요청 생성 (게스트/팀원/관리자)
export async function POST(req: NextRequest) {
  try {
    const session = await getSession(); // null이면 게스트
    const body = await req.json();

    const sb = createServerClient();

    // column_model_id 없고 cat_no 있으면 기존 칼럼 조회 or 신규 생성
    let columnModelId = body.column_model_id;
    if (!columnModelId && body.cat_no) {
      const { data: existing } = await sb
        .from('column_models')
        .select('id')
        .eq('cat_no', body.cat_no.trim())
        .maybeSingle();

      if (existing) {
        columnModelId = existing.id;
      } else if (body.model_name) {
        const { data: newCol, error: colErr } = await sb
          .from('column_models')
          .insert({
            model_name: body.model_name.trim(),
            cat_no: body.cat_no.trim(),
            size: body.size || null,
            particle_size: body.particle_size ? parseFloat(body.particle_size) : null,
            total_stock: 0,
            min_safety_stock: 2,
            unit_price: 0,
          })
          .select('id')
          .single();
        if (colErr) throw colErr;
        columnModelId = newCol.id;
      }
    }

    if (!columnModelId || !body.quantity) {
      return NextResponse.json({ error: '필수 항목이 누락되었습니다 (칼럼 또는 수량)' }, { status: 400 });
    }

    // 요청자: 폼에서 지정한 값 우선, 없으면 세션 기반, 그것도 없으면 '익명'
    const sessionName = session
      ? (session.type === 'admin' ? (session as any).username : (session as any).user_name)
      : null;
    const requestedBy = body.requester_name?.trim() || sessionName || '익명';

    const department = session?.type === 'user'
      ? (session as any).department
      : null;

    const { data, error } = await sb
      .from('purchase_requests')
      .insert({
        column_model_id: columnModelId,
        requested_by: requestedBy,
        department: department,
        quantity: body.quantity,
        reason: body.reason || null,
        urgency: body.urgency || 'normal',
        status: 'pending',
      })
      .select('*, column_models(*)')
      .single();

    if (error) throw error;

    await sb.from('activity_logs').insert({
      actor: requestedBy,
      actor_type: session?.type ?? 'guest',
      action: 'create_purchase_request',
      target_type: 'purchase_request',
      target_id: data.id,
      details: {
        column: data.column_models?.model_name,
        quantity: body.quantity,
      },
    });

    return NextResponse.json({ request: data });
  } catch (e: any) {
    if (e.message?.includes('로그인')) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    console.error('Request POST error:', e);
    return NextResponse.json({ error: '요청 생성 실패: ' + e.message }, { status: 500 });
  }
}
