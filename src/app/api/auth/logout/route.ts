import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSession } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';

export async function POST() {
  try {
    const session = await getSession();
    if (session) {
      try {
        const sb = createServerClient();
        const actor = session.type === 'admin' 
          ? (session as any).username 
          : (session as any).user_name;
        await sb.from('activity_logs').insert({
          actor,
          actor_type: session.type,
          action: 'logout',
        });
      } catch {}
    }

    cookies().delete('session_token');
    return NextResponse.json({ ok: true });
  } catch (e) {
    cookies().delete('session_token');
    return NextResponse.json({ ok: true });
  }
}
