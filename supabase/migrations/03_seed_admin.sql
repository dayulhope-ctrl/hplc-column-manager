-- ============================================
-- 초기 관리자 계정 생성
-- ID: 16242
-- PW: aa123123. (Next.js 앱에서 bcrypt로 해시 후 저장)
-- ============================================
-- 주의: 이 SQL은 placeholder만 생성합니다.
-- 실제 비밀번호 해시는 앱 첫 실행 시 자동 생성됩니다.

INSERT INTO admins (username, password_hash, name)
VALUES ('16242', 'PLACEHOLDER_WILL_BE_SET_BY_APP', '관리자')
ON CONFLICT (username) DO NOTHING;
