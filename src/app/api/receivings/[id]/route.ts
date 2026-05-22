import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';

// 입고 기록 취소: receiving_record 삭제 + 재고 원복 + purchase_request → ordered 복귀
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requireAdmin();
    const sb = createServerClient();

    // 입고 기록 조회
    const { data: rec, error: recErr } = await sb
      .from('receiving_records')
      .select('*')
      .eq('id', params.id)
      .single();

    if (recErr || !rec) {
      return NextResponse.json({ error: '입고 기록을 찾을 수 없습니다' }, { status: 404 });
    }

    // 1. 재고 감소 원복 (입고 시 증가된 재고를 되돌림)
    const { error: rpcError } = await sb.rpc('increment_column_stock', {
      col_id: rec.column_model_id,
      qty: -rec.quantity,
    });
    if (rpcError) {
      // RPC 실패 시 직접 업데이트로 fallback
      const { data: colData } = await sb
        .from('column_models')
        .select('total_stock')
        .eq('id', rec.column_model_id)
        .single();
      await sb
        .from('column_models')
        .update({ total_stock: Math.max(0, (colData?.total_stock || 0) - rec.quantity) })
        .eq('id', rec.column_model_id);
    }

    // 2. 칼럼 발주 상태 복원 ('발주 완료'로 되돌림)
    await sb
      .from('column_models')
      .update({
        purchase_status: '발주 완료',
        purchase_quantity: rec.quantity,
        order_date: rec.order_date,
      })
      .eq('id', rec.column_model_id);

    // 3. 연결된 purchase_request 상태를 ordered로 복귀
    if (rec.purchase_request_id) {
      await sb
        .from('purchase_requests')
        .update({ status: 'ordered', received_at: null })
        .eq('id', rec.purchase_request_id);
    }

    // 4. 입고 기록 삭제
    const { error: delErr } = await sb
      .from('receiving_records')
      .delete()
      .eq('id', params.id);
    if (delErr) throw delErr;

    await sb.from('activity_logs').insert({
      actor: admin.username,
      actor_type: 'admin',
      action: 'cancel_receive',
      target_type: 'receiving_record',
      target_id: params.id,
      details: { model_name: rec.model_name, quantity: rec.quantity },
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e.message?.includes('관리자')) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    console.error('Receiving DELETE error:', e);
    return NextResponse.json({ error: '입고 취소 실패: ' + e.message }, { status: 500 });
  }
}
