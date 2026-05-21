import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';

// 보호된 페이지
const PROTECTED_PATHS = ['/dashboard', '/admin'];
const ADMIN_ONLY_PATHS = ['/admin'];

// IP 화이트리스트 (필요시 환경변수에서)
const ALLOWED_IPS = process.env.ALLOWED_IPS?.split(',').map(s => s.trim()).filter(Boolean) || [];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // IP 제한 (설정된 경우만)
  if (ALLOWED_IPS.length > 0) {
    const clientIp = req.ip 
      || req.headers.get('x-forwarded-for')?.split(',')[0].trim()
      || req.headers.get('x-real-ip')
      || '';
    
    // 로컬 개발은 허용
    const isLocal = clientIp === '::1' || clientIp.startsWith('127.') || clientIp.startsWith('192.168.') || clientIp.startsWith('10.');
    
    if (!isLocal && !ALLOWED_IPS.includes(clientIp)) {
      return new NextResponse('접근 권한이 없습니다 (IP 제한)', { status: 403 });
    }
  }

  // 보호된 경로 체크
  const needsAuth = PROTECTED_PATHS.some(p => pathname.startsWith(p));
  if (!needsAuth) return NextResponse.next();

  const token = req.cookies.get('session_token')?.value;
  if (!token) {
    return NextResponse.redirect(new URL('/', req.url));
  }

  const session = await verifyToken(token);
  if (!session) {
    const res = NextResponse.redirect(new URL('/', req.url));
    res.cookies.delete('session_token');
    return res;
  }

  // 관리자 전용 경로 체크
  const isAdminPath = ADMIN_ONLY_PATHS.some(p => pathname.startsWith(p));
  if (isAdminPath && session.type !== 'admin') {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/admin/:path*',
  ],
};
