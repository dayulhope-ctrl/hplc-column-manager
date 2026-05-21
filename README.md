# HPLC 칼럼 관리 시스템

회사 HPLC 칼럼 재고 및 사용 이력 관리 웹 플랫폼입니다.

## ✨ 주요 기능

- 👥 **팀원 모드**: 이름만 입력하고 접속 (30명 사용)
- 👨‍💼 **관리자 모드**: ID/PW 인증 (30분 세션 자동 만료)
- 📦 **104개 칼럼 데이터** 사전 등록
- 🛒 **구매 요청 워크플로우** (요청 → 승인 → 발주 → 입고)
- 📊 **실시간 대시보드** (재고, 구매 필요, 발주 현황)
- 🔔 **재고 부족 알림** 자동 표시
- 📝 **활동 이력** 감사 로그
- 📱 **반응형 디자인** (PC/모바일 모두 지원)

---

## 🚀 빠른 시작 (10분 완성)

### 1단계: Supabase 프로젝트 생성

1. https://supabase.com 접속 → 로그인
2. **"New project"** 클릭
3. 프로젝트 정보:
   - Name: `hplc-column-manager`
   - Database Password: (강력한 비밀번호, 메모 필수)
   - Region: `Northeast Asia (Seoul)` 선택
4. **"Create new project"** 클릭 (생성 2~3분 소요)

### 2단계: 데이터베이스 스키마 생성

1. 좌측 메뉴 **"SQL Editor"** 클릭
2. **"New query"** 클릭
3. `supabase/migrations/01_initial_schema.sql` 파일 내용 전체 복사
4. SQL Editor에 붙여넣기
5. 우측 하단 **"Run"** 버튼 클릭 (또는 `Ctrl+Enter`)
6. 같은 방법으로 `02_seed_columns.sql` 실행 (104개 칼럼 데이터)
7. 같은 방법으로 `03_seed_admin.sql` 실행 (관리자 placeholder)

### 3단계: Supabase API 키 복사

1. 좌측 메뉴 **"Settings"** → **"API"** 클릭
2. 다음 값들을 복사해두기:
   - **Project URL** (예: `https://xxxxx.supabase.co`)
   - **anon public** key
   - **service_role** key (⚠️ 비공개)

### 4단계: 환경변수 설정

`.env.example` 파일을 `.env.local`로 복사한 뒤 값 채우기:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJh...
SUPABASE_SERVICE_ROLE_KEY=eyJh...

# JWT_SECRET 생성: openssl rand -base64 32
JWT_SECRET=랜덤한_긴_문자열_32자_이상

# 관리자 초기 비밀번호 (첫 로그인 시 자동 암호화 저장)
ADMIN_USERNAME=16242
ADMIN_PASSWORD=aa123123.
```

### 5단계: 로컬 실행

```bash
# 의존성 설치
npm install

# 개발 서버 시작
npm run dev
```

브라우저에서 http://localhost:3000 접속!

### 6단계: 첫 관리자 로그인

1. http://localhost:3000 접속
2. **"관리자"** 탭 클릭
3. ID: `16242` / PW: `aa123123.` 입력
4. 첫 로그인 시 비밀번호가 자동으로 bcrypt 암호화되어 DB에 저장됩니다

---

## 🌐 배포 (Vercel - 무료)

### 1. GitHub에 코드 업로드

```bash
git init
git add .
git commit -m "Initial commit"
# GitHub에서 새 저장소 만들고
git remote add origin https://github.com/your-username/hplc-manager.git
git push -u origin main
```

### 2. Vercel 배포

1. https://vercel.com 접속 → GitHub로 로그인
2. **"Add New"** → **"Project"** 클릭
3. GitHub 저장소 선택 → **"Import"**
4. **Environment Variables** 섹션에서 `.env.local`의 모든 값 추가:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `JWT_SECRET`
   - `ADMIN_USERNAME`
   - `ADMIN_PASSWORD`
   - (선택) `ALLOWED_IPS` - IP 제한 시
5. **"Deploy"** 클릭 → 2분 대기
6. 배포 완료! 자동으로 URL 생성됨 (예: `https://hplc-manager.vercel.app`)

### 3. (선택) 회사 도메인 연결

Vercel → Project → Settings → Domains → Add Domain

---

## 🔒 보안 설정

### IP 화이트리스트 (사내 네트워크만 접속)

`.env.local`에 회사 IP 추가:

```bash
# 콤마로 여러 개 가능
ALLOWED_IPS=123.456.789.0,234.567.890.1
```

> 회사 IP 확인: https://www.whatismyip.com 에서 회사 와이파이로 접속

### 관리자 비밀번호 변경

방법 1: Supabase Table Editor에서 직접 수정
```sql
UPDATE admins 
SET password_hash = 'PLACEHOLDER_WILL_BE_SET_BY_APP'
WHERE username = '16242';
```
`.env.local`의 `ADMIN_PASSWORD`를 새 비밀번호로 변경한 후 재로그인 → 자동 암호화 저장

---

## 📁 프로젝트 구조

```
hplc-system/
├── src/
│   ├── app/
│   │   ├── page.tsx                # 로그인 페이지
│   │   ├── dashboard/              # 팀원 대시보드
│   │   ├── admin/                  # 관리자 페이지
│   │   └── api/                    # API 라우트
│   │       ├── auth/               # 로그인/로그아웃
│   │       ├── columns/            # 칼럼 CRUD
│   │       ├── requests/           # 구매 요청
│   │       ├── receivings/         # 입고 기록
│   │       ├── stats/              # 대시보드 통계
│   │       └── logs/               # 활동 이력
│   ├── components/                 # 공통 컴포넌트
│   ├── lib/                        # 인증, Supabase 클라이언트
│   ├── types/                      # TypeScript 타입
│   └── middleware.ts               # 인증/IP 체크
├── supabase/migrations/            # DB 스키마 SQL
└── .env.example                    # 환경변수 예시
```

---

## 👥 사용 시나리오

### 팀원 (30명)
1. 사이트 접속
2. **"팀원"** 탭 → 이름 입력 → "입장하기"
3. 대시보드에서 칼럼 검색
4. 필요한 칼럼 옆 🛒 클릭 → 수량/사유 입력 → 요청 제출
5. "구매요청 내역" 탭에서 진행 상황 확인

### 관리자 (당신)
1. 사이트 접속
2. **"관리자"** 탭 → ID/PW 입력
3. 상단에 대기 요청 알림 표시 → 클릭
4. 요청 검토 → **승인/거부** 처리
5. 승인된 요청 → **발주** 처리
6. 입고 완료 시 → **입고처리** 클릭 (재고 자동 증가, 입고 기록 자동 생성)

---

## 🛠️ 트러블슈팅

### Supabase 연결 실패
- `.env.local`의 URL/Key 확인
- Supabase 프로젝트가 "Active" 상태인지 확인

### 로그인 안 됨
- 브라우저 개발자 도구 → Network 탭 → 에러 메시지 확인
- 쿠키 차단 설정 해제

### 데이터가 안 보임
- Supabase Table Editor에서 `column_models` 테이블에 데이터 있는지 확인
- 없으면 `02_seed_columns.sql` 다시 실행

---

## 📞 추가 개발 요청

- 엑셀 일괄 임포트
- 이메일 알림
- 차트/그래프
- 보고서 PDF 출력
- 등등...

필요하면 언제든 추가 요청해주세요!
