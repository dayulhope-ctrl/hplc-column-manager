import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';

export async function GET() {
  try {
    await requireAdmin();
    const sb = createServerClient();
    const { data, error } = await sb
      .from('activity_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    return NextResponse.json({ logs: data || [] });
  } catch (e: any) {
    if (e.message?.includes('관리자')) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    return NextResponse.json({ error: '조회 실패' }, { status: 500 });
  }
}
