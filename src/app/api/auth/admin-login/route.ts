import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import { createAdminToken, SESSION_DURATIONS } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json({ error: 'ID와 비밀번호를 입력해주세요' }, { status: 400 });
    }

    const sb = createServerClient();

    // 관리자 조회
    const { data: admin, error } = await sb
      .from('admins')
      .select('*')
      .eq('username', username)
      .single();

    if (error || !admin) {
      // 보안: 동일한 메시지로 응답 (사용자 존재 여부 감추기)
      return NextResponse.json({ error: 'ID 또는 비밀번호가 올바르지 않습니다' }, { status: 401 });
    }

    // 최초 로그인 처리 (placeholder 비밀번호인 경우)
    if (admin.password_hash === 'PLACEHOLDER_WILL_BE_SET_BY_APP') {
      const envPassword = process.env.ADMIN_PASSWORD;
      const envUsername = process.env.ADMIN_USERNAME;
      
      if (username !== envUsername || password !== envPassword) {
        return NextResponse.json({ error: 'ID 또는 비밀번호가 올바르지 않습니다' }, { status: 401 });
      }
      
      // 비밀번호 해시 후 저장
      const hashedPw = await bcrypt.hash(password, 10);
      await sb
        .from('admins')
        .update({ password_hash: hashedPw })
        .eq('id', admin.id);
    } else {
      // 일반 로그인 - bcrypt 검증
      const valid = await bcrypt.compare(password, admin.password_hash);
      if (!valid) {
        return NextResponse.json({ error: 'ID 또는 비밀번호가 올바르지 않습니다' }, { status: 401 });
      }
    }

    // 마지막 로그인 시간 업데이트
    await sb
      .from('admins')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', admin.id);

    // 활동 로그
    await sb.from('activity_logs').insert({
      actor: admin.username,
      actor_type: 'admin',
      action: 'admin_login',
    });

    // JWT 토큰 생성
    const token = await createAdminToken({
      id: admin.id,
      username: admin.username,
      name: admin.name,
    });

    // 쿠키 설정 (30분)
    cookies().set('session_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: SESSION_DURATIONS.admin,
      path: '/',
    });

    return NextResponse.json({
      ok: true,
      admin: { username: admin.username, name: admin.name },
    });
  } catch (e: any) {
    console.error('Admin login error:', e);
    return NextResponse.json({ error: '로그인 처리 중 오류가 발생했습니다' }, { status: 500 });
  }
}
