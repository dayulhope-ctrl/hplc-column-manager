import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requireAdmin();
    const sb = createServerClient();

    const { error } = await sb.from('receiving_records').delete().eq('id', params.id);
    if (error) throw error;

    await sb.from('activity_logs').insert({
      actor: admin.username,
      actor_type: 'admin',
      action: 'delete_receiving',
      target_type: 'receiving_record',
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
