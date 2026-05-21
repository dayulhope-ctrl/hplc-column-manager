import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createUserToken, SESSION_DURATIONS } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const { user_name, department } = await req.json();

    if (!user_name || typeof user_name !== 'string' || !user_name.trim()) {
      return NextResponse.json({ error: '이름을 입력해주세요' }, { status: 400 });
    }

    const name = user_name.trim();
    if (name.length > 50) {
      return NextResponse.json({ error: '이름이 너무 깁니다' }, { status: 400 });
    }

    // 토큰 생성
    const token = await createUserToken({
      user_name: name,
      department: department || undefined,
    });

    // 세션 기록 (감사용)
    try {
      const sb = createServerClient();
      const expiresAt = new Date(Date.now() + SESSION_DURATIONS.user * 1000);
      await sb.from('user_sessions').insert({
        user_name: name,
        department: department || null,
        session_token: token.substring(0, 32), // 일부만 저장
        expires_at: expiresAt.toISOString(),
      });

      // 활동 로그
      await sb.from('activity_logs').insert({
        actor: name,
        actor_type: 'user',
        action: 'login',
      });
    } catch (e) {
      // 로깅 실패해도 로그인은 계속
      console.error('Session logging failed:', e);
    }

    // 쿠키 설정
    cookies().set('session_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: SESSION_DURATIONS.user,
      path: '/',
    });

    return NextResponse.json({ ok: true, user_name: name });
  } catch (e: any) {
    console.error('User login error:', e);
    return NextResponse.json({ error: '로그인 처리 중 오류가 발생했습니다' }, { status: 500 });
  }
}
