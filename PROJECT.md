# HPLC 칼럼 관리 시스템 — 프로젝트 문서

> 최종 업데이트: 2026-06-19  
> 저장소: https://github.com/dayulhope-ctrl/hplc-column-manager  
> 운영 URL: https://hplc-column-manager.vercel.app  
> 관리자 페이지: https://hplc-column-manager.vercel.app/admin

---

## 목차

1. [기술 스택](#1-기술-스택)
2. [인프라 구성](#2-인프라-구성)
3. [DB 스키마](#3-db-스키마)
4. [주요 파일 구조](#4-주요-파일-구조)
5. [기능 목록](#5-기능-목록)
6. [구매 흐름](#6-구매-흐름)
7. [localStorage 키 정리](#7-localstorage-키-정리)
8. [환경변수](#8-환경변수)
9. [배포 방법](#9-배포-방법)

---

## 1. 기술 스택

| 구분 | 기술 |
|------|------|
| 프레임워크 | Next.js 14 (App Router) |
| 언어 | TypeScript |
| 스타일 | Tailwind CSS |
| DB | Supabase (PostgreSQL) |
| 배포 | Vercel (GitHub 연동 자동 배포) |
| 아이콘 | lucide-react |
| 인증 | JWT (httpOnly 쿠키), bcrypt |

---

## 2. 인프라 구성

```
GitHub (dayulhope-ctrl/hplc-column-manager)
    ↓ push → 자동 배포
Vercel (hplc-column-manager.vercel.app)
    ↓ API 호출
Supabase (ashdwpxtdklbnoediyiy, 서울 리전)
```

- **Lovable**: 초기 코드 생성에만 사용. 현재 운영과 무관 (삭제해도 무방).
- **배포 트리거**: `main` 브랜치 push 시 Vercel 자동 배포.

---

## 3. DB 스키마

### `column_models` — 칼럼 모델 목록

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | UUID | PK |
| `model_name` | TEXT | 모델명 |
| `cat_no` | TEXT | 카탈로그 번호 |
| `size` | TEXT | 사이즈 (예: "4.6mm x 250mm") |
| `particle_size` | NUMERIC | 입자 크기 (µm) |
| `total_stock` | INT | 현재 재고 수량 |
| `min_safety_stock` | INT | 최소 안전재고 (0이면 재고부족 자동추가 안 함) |
| `unit_price` | INT | 단가 (원) |
| `kep_code` | TEXT | KEP 코드 |
| `purchase_required` | BOOL | 구매 필요 여부 |
| `purchase_status` | TEXT | '발주 완료' / '입고 완료' / '구매 승인' / null |
| `purchase_quantity` | INT | 발주 수량 |
| `order_date` | DATE | 발주일 |
| `notes` | TEXT | 비고 |
| `products_used` | TEXT[] | 사용 제품 |
| `is_draft` | BOOL | 초안 여부 (대시보드 표시 제외) |
| `is_hidden` | BOOL | 숨김 여부 (soft delete, 데이터 보존) |
| `created_at` | TIMESTAMPTZ | 생성일 |
| `updated_at` | TIMESTAMPTZ | 수정일 |

> **사이즈 파싱 규칙**: `"4.6mm x 250mm"` → 첫 번째 숫자 = 내경(mm), 두 번째 숫자 = 길이(mm)

### `purchase_requests` — 구매 요청

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | UUID | PK |
| `column_model_id` | UUID | FK → column_models |
| `requested_by` | TEXT | 요청자 이름 |
| `department` | TEXT | 부서 |
| `quantity` | INT | 요청 수량 |
| `reason` | TEXT | 요청 사유 |
| `urgency` | TEXT | 긴급도 (low/normal/high/urgent) |
| `status` | TEXT | pending → approved/rejected → ordered → received |
| `reviewed_by` | TEXT | 승인/거부한 관리자 |
| `reviewed_at` | TIMESTAMPTZ | 검토일시 |
| `review_notes` | TEXT | 검토 메모 |
| `ordered_at` | TIMESTAMPTZ | 발주일시 |
| `received_at` | TIMESTAMPTZ | 입고일시 |
| `is_admin_direct` | BOOL | 관리자 직접 발주 여부 (팀원 목록에서 제외) |
| `created_at` | TIMESTAMPTZ | 생성일 |

### `receiving_records` — 입고 기록

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | UUID | PK |
| `column_model_id` | UUID | FK → column_models |
| `purchase_request_id` | UUID | FK → purchase_requests |
| `model_name` | TEXT | 모델명 (스냅샷) |
| `cat_no` | TEXT | Cat. No (스냅샷) |
| `quantity` | INT | 입고 수량 |
| `unit_price` | INT | 단가 |
| `total_price` | INT | 합계 |
| `receiving_date` | DATE | 입고일 |
| `received_by` | TEXT | 입고 처리한 관리자 |

### `activity_logs` — 활동 이력

모든 주요 액션(칼럼 수정, 구매요청 처리 등)이 자동 기록됨.

### `monthly_closings` — 월별 마감

### `admin_sessions` — 관리자 세션 (JWT 기반)

---

## 4. 주요 파일 구조

```
src/
├── app/
│   ├── page.tsx                    # 랜딩 페이지 (팀원/관리자 진입)
│   ├── stock/
│   │   ├── page.tsx                # 재고조회 페이지
│   │   └── StockClient.tsx         # 재고 테이블 클라이언트
│   ├── request/
│   │   └── page.tsx                # 팀원 구매요청 페이지
│   ├── dashboard/
│   │   ├── page.tsx
│   │   └── DashboardClient.tsx     # 팀원 대시보드
│   ├── admin/
│   │   ├── page.tsx
│   │   └── AdminClient.tsx         # 관리자 대시보드 (탭 UI)
│   └── api/
│       ├── auth/                   # 로그인/로그아웃
│       ├── columns/
│       │   ├── route.ts            # GET(목록), POST(신규)
│       │   └── [id]/route.ts       # PATCH(수정), DELETE(숨김처리)
│       ├── requests/
│       │   ├── route.ts            # GET(목록), POST(신규)
│       │   └── [id]/route.ts       # PATCH(승인/발주/입고), DELETE
│       ├── receivings/route.ts     # 입고 기록
│       ├── stats/route.ts          # 대시보드 통계
│       └── logs/route.ts           # 활동 이력
├── components/
│   ├── CartTab.tsx                 # 장바구니 탭 (통합)
│   ├── ColumnTable.tsx             # 칼럼 재고 테이블 (필터 포함)
│   ├── RequestsPanel.tsx           # 구매요청 목록
│   └── ReceivingsPanel.tsx         # 입고확인 목록
├── lib/
│   ├── auth.ts                     # JWT 인증
│   ├── supabase.ts                 # Supabase 클라이언트
│   └── telegram.ts                 # 텔레그램 알림
└── types/index.ts                  # TypeScript 타입 정의
```

---

## 5. 기능 목록

### 팀원 기능
- 이름만 입력하고 접속 (localStorage 저장, 30일 유지)
- 칼럼 재고 조회 (`/stock`) — 내경/길이/입자 필터
- 구매요청 제출 (`/request`) — 수량/사유/긴급도
- 구매요청 내역 조회

### 관리자 기능
- ID/PW 로그인 (30분 세션)
- **대시보드**: 통계 카드 (총 칼럼수, 재고 합계, 구매 필요, 입고 예정)
- **구매요청**: 팀원 요청 승인/거부
- **장바구니**: 승인됨 + 재고부족 자동추가 + 수동추가 통합 관리
  - 항목별 단가/수량/긴급도 수정
  - **단가 수정 시 대시보드 칼럼 단가 자동 동기화**
  - 선택 발주 또는 전체 발주완료
- **입고확인**: 발주완료 항목 입고처리 → 재고 자동 증가
- **마감자료**: 월별 마감 기록
- **총 구매내역**: 전체 입고 이력
- **칼럼 이력**: activity_logs 기반 변경 이력
- 칼럼 수정/등록/숨기기
- 텔레그램 알림 (팀원 구매요청 발생 시)

### 칼럼 숨기기 (Soft Delete)
- 대시보드에서 보이지 않게 처리 (`is_hidden=true`)
- 관련 데이터(구매요청, 입고기록) 보존
- 숨김 처리 시 관련 pending/approved 구매요청 자동 취소

---

## 6. 구매 흐름

```
[팀원] /request → 구매요청 제출 (status: pending)
         ↓ 텔레그램 알림 → 관리자
[관리자] 구매요청 탭 → 승인 (status: approved)
         ↓
[장바구니] 승인됨 항목 자동 추가 + 재고부족 칼럼 자동 추가
         ↓ 발주완료 버튼
[입고확인] 발주 대기 (status: ordered)
         ↓ 입고확인 버튼
[마감자료] 입고 완료 (status: received) + 재고 자동 증가 + receiving_records 생성
         ↓ 월말
월별 마감 기록
```

### 장바구니 아이템 구분
| 뱃지 | 설명 | 발주 처리 |
|------|------|-----------|
| 🔵 승인됨 | 팀원 구매요청 승인된 항목 | `PATCH /api/requests/{id}` action:'order' |
| 🔴 재고부족 | 재고 0 칼럼 자동 추가 | `POST /api/requests` initial_status:'ordered' |
| ⚪ 수동추가 | 관리자 직접 추가 | `POST /api/requests` initial_status:'ordered' |

---

## 7. localStorage 키 정리

| 키 | 내용 |
|----|------|
| `hplc_guest_name` | 팀원 이름 (30일 유지) |
| `hplc_cart_v2` | 장바구니 direct 항목 (재고부족/수동추가) |
| `hplc_cart_removed_v2` | 수동 삭제한 칼럼 ID 목록 |
| `hplc_cart_approved_edits` | 승인됨 항목 수정 내용 (purchaseRequestId 기준) |
| `hplc_column_filter` | 칼럼 테이블 필터 상태 (lengths/inners/particles 배열) |

---

## 8. 환경변수

| 변수 | 필수 | 설명 |
|------|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Supabase service role key (서버 전용) |
| `JWT_SECRET` | ✅ | 관리자 세션 JWT 서명 키 |
| `ADMIN_USERNAME` | ✅ | 관리자 ID (예: 16242) |
| `ADMIN_PASSWORD` | ✅ | 관리자 초기 비밀번호 (첫 로그인 시 bcrypt 암호화) |
| `TELEGRAM_BOT_TOKEN` | ⬜ | 텔레그램 봇 토큰 (@column_hooon_bot) |
| `TELEGRAM_CHAT_ID` | ⬜ | 텔레그램 수신 Chat ID (8808750951) |

---

## 9. 배포 방법

### 로컬 개발
```bash
npm install
npm run dev
# http://localhost:3000
```

### 운영 배포
`main` 브랜치에 push하면 Vercel이 자동 감지 → 빌드 → 배포 (약 2분 소요).

```bash
git add .
git commit -m "커밋 메시지"
git push origin main
```

### Supabase 프로젝트 정보
- 프로젝트 ID: `ashdwpxtdklbnoediyiy`
- 리전: `ap-northeast-2` (서울)
- DB 호스트: `db.ashdwpxtdklbnoediyiy.supabase.co`
