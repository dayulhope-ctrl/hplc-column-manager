import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';

// 구매 요청 처리 (승인/거부/발주/입고) - 관리자만
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requireAdmin();
    const body = await req.json();
    const { action, notes, unit_price, receiving_date } = body;

    if (!['approve', 'reject', 'order', 'receive', 'cancel_order'].includes(action)) {
      return NextResponse.json({ error: '잘못된 액션' }, { status: 400 });
    }

    const sb = createServerClient();

    // 요청 조회
    const { data: request, error: reqError } = await sb
      .from('purchase_requests')
      .select('*, column_models(*)')
      .eq('id', params.id)
      .single();

    if (reqError || !request) {
      return NextResponse.json({ error: '요청을 찾을 수 없습니다' }, { status: 404 });
    }

    const updateData: any = {
      reviewed_by: admin.username,
      reviewed_at: new Date().toISOString(),
      review_notes: notes || null,
    };

    if (action === 'approve') {
      updateData.status = 'approved';
    } else if (action === 'reject') {
      updateData.status = 'rejected';
    } else if (action === 'order') {
      updateData.status = 'ordered';
      updateData.ordered_at = new Date().toISOString();
      // 칼럼 발주 상태 업데이트
      await sb
        .from('column_models')
        .update({
          purchase_status: '발주 완료',
          purchase_quantity: request.quantity,
          order_date: new Date().toISOString().split('T')[0],
        })
        .eq('id', request.column_model_id);
    } else if (action === 'receive') {
      updateData.status = 'received';
      updateData.received_at = new Date().toISOString();

      const col = request.column_models;
      const finalUnitPrice = unit_price ?? col?.unit_price ?? 0;
      const finalReceivingDate = receiving_date ?? new Date().toISOString().split('T')[0];

      // 재고 원자적 증가 (RPC 사용 - race condition 방지)
      const { error: rpcError } = await sb.rpc('increment_column_stock', {
        col_id: request.column_model_id,
        qty: request.quantity,
      });
      if (rpcError) throw rpcError;

      // 발주 상태 초기화
      await sb
        .from('column_models')
        .update({
          purchase_status: null,
          purchase_quantity: null,
          order_date: null,
        })
        .eq('id', request.column_model_id);

      // 입고 기록 생성
      await sb.from('receiving_records').insert({
        column_model_id: request.column_model_id,
        purchase_request_id: request.id,
        order_date: col?.order_date,
        kep_code: col?.kep_code,
        model_name: col?.model_name,
        cat_no: col?.cat_no,
        size: col?.size,
        particle_size: col?.particle_size,
        quantity: request.quantity,
        unit_price: finalUnitPrice,
        total_price: finalUnitPrice * request.quantity,
        receiving_date: finalReceivingDate,
        received_by: admin.username,
      });
    }

    if (action === 'cancel_order') {
      updateData.status = 'approved';
      updateData.ordered_at = null;
      // 칼럼 발주 상태 초기화
      await sb
        .from('column_models')
        .update({ purchase_status: null, purchase_quantity: null, order_date: null })
        .eq('id', request.column_model_id);
    }

    const { data, error } = await sb
      .from('purchase_requests')
      .update(updateData)
      .eq('id', params.id)
      .select('*, column_models(*)')
      .single();

    if (error) throw error;

    await sb.from('activity_logs').insert({
      actor: admin.username,
      actor_type: 'admin',
      action: `request_${action}`,
      target_type: 'purchase_request',
      target_id: params.id,
      details: { notes },
    });

    return NextResponse.json({ request: data });
  } catch (e: any) {
    if (e.message?.includes('관리자')) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    console.error('Request PATCH error:', e);
    return NextResponse.json({ error: '처리 실패: ' + e.message }, { status: 500 });
  }
}

// 구매 요청 취소 (관리자)
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requireAdmin();
    const sb = createServerClient();

    const { error } = await sb
      .from('purchase_requests')
      .delete()
      .eq('id', params.id);

    if (error) throw error;

    await sb.from('activity_logs').insert({
      actor: admin.username,
      actor_type: 'admin',
      action: 'delete_request',
      target_type: 'purchase_request',
      target_id: params.id,
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e.message?.includes('관리자')) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    return NextResponse.json({ error: '삭제 실패' }, { status: 500 });
  }
}
