import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';

export async function GET(req: Request) {
  try {
    await requireAuth();
    const { searchParams } = new URL(req.url);
    const month = searchParams.get('month'); // YYYY-MM
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    const sb = createServerClient();
    let query = sb.from('receiving_records').select('*').order('receiving_date', { ascending: false });

    if (month) {
      const start = `${month}-01`;
      const [y, m] = month.split('-').map(Number);
      const lastDay = new Date(y, m, 0).getDate();
      const end = `${month}-${String(lastDay).padStart(2, '0')}`;
      query = query.gte('receiving_date', start).lte('receiving_date', end);
    } else {
      if (from) query = query.gte('receiving_date', from);
      if (to) query = query.lte('receiving_date', to);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ records: data || [] });
  } catch (e: any) {
    if (e.message?.includes('로그인')) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    return NextResponse.json({ error: '조회 실패' }, { status: 500 });
  }
}
