import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'default-secret-please-change-in-production-32chars'
);

const ADMIN_SESSION_DURATION = 30 * 60; // 30분
const USER_SESSION_DURATION = 8 * 60 * 60; // 8시간

export interface AdminTokenPayload {
  id: string;
  username: string;
  name: string;
  type: 'admin';
  iat?: number;
  exp?: number;
}

export interface UserTokenPayload {
  user_name: string;
  department?: string;
  type: 'user';
  iat?: number;
  exp?: number;
}

export type TokenPayload = AdminTokenPayload | UserTokenPayload;

// 토큰 생성
export async function createAdminToken(payload: Omit<AdminTokenPayload, 'type'>) {
  const token = await new SignJWT({ ...payload, type: 'admin' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${ADMIN_SESSION_DURATION}s`)
    .sign(JWT_SECRET);
  return token;
}

export async function createUserToken(payload: Omit<UserTokenPayload, 'type'>) {
  const token = await new SignJWT({ ...payload, type: 'user' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${USER_SESSION_DURATION}s`)
    .sign(JWT_SECRET);
  return token;
}

// 토큰 검증
export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as TokenPayload;
  } catch {
    return null;
  }
}

// 서버에서 현재 세션 가져오기
export async function getSession(): Promise<TokenPayload | null> {
  const cookieStore = cookies();
  const token = cookieStore.get('session_token')?.value;
  if (!token) return null;
  return verifyToken(token);
}

// 관리자 세션 확인
export async function requireAdmin(): Promise<AdminTokenPayload> {
  const session = await getSession();
  if (!session || session.type !== 'admin') {
    throw new Error('관리자 권한이 필요합니다');
  }
  return session as AdminTokenPayload;
}

// 사용자 세션 확인 (관리자도 OK)
export async function requireAuth(): Promise<TokenPayload> {
  const session = await getSession();
  if (!session) {
    throw new Error('로그인이 필요합니다');
  }
  return session;
}

export const SESSION_DURATIONS = {
  admin: ADMIN_SESSION_DURATION,
  user: USER_SESSION_DURATION,
};
