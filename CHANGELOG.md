# HPLC 칼럼 관리 시스템 — 개발 히스토리

> 작성일: 2026-06-01  
> 저장소: https://github.com/dayulhope-ctrl/hplc-column-manager  
> 배포: https://hplc-column-manager.vercel.app

---

## 목차
1. [구매 흐름 재설계](#1-구매-흐름-재설계)
2. [장바구니 통합](#2-장바구니-통합)
3. [관리자 직접발주 분리](#3-관리자-직접발주-분리)
4. [입고확인 4종 복구](#4-입고확인-4종-복구)
5. [장바구니 중복 방지](#5-장바구니-중복-방지)
6. [팀원용 랜딩 페이지](#6-팀원용-랜딩-페이지)
7. [장바구니 수정 버튼](#7-장바구니-수정-버튼)
8. [텔레그램 알림](#8-텔레그램-알림)

---

## 1. 구매 흐름 재설계

### 문제
장바구니 "발주완료" 버튼이 새 구매요청(pending)을 생성해 구매요청 탭에서 또 승인/거부를 받는 잘못된 흐름이었음.

### 목표 흐름
```
[팀원] 구매요청 탭 신청 (pending)
    ↓
[관리자] 승인 / 거부
    ↓ 승인됨(approved)
[장바구니] 승인된 요청 + 재고부족 칼럼
    ↓ 발주완료
[입고확인] 발주 대기 (ordered)
    ↓ 입고확인
[마감자료] 입고 완료 (received)
    ↓ 월말 마감
월별 마감 기록
```

### 변경 파일
| 파일 | 내용 |
|------|------|
| `src/components/RequestsPanel.tsx` | pending/approved/rejected만 표시, ordered/received 제거. 상태 표시: 승인대기/구매대기/결제완료/입고완료 |
| `src/components/CartTab.tsx` | 섹션A(승인된요청) + 섹션B(재고부족) 분리 구현 |
| `src/components/ReceivingsPanel.tsx` | ordered 상태 구매요청 표시, 입고확인 버튼으로 received 전환 |
| `src/app/api/requests/[id]/route.ts` | PATCH action: approve/reject/order/receive 처리 |
| `src/app/dashboard/DashboardClient.tsx` | approvedRequests/orderedRequests prop 전달 |
| `src/app/admin/AdminClient.tsx` | 동일하게 prop 업데이트 |

---

## 2. 장바구니 통합

### 문제
장바구니가 섹션A(승인된 구매요청)와 섹션B(재고부족 직접발주)로 나뉘어 불편함.

### 해결
`UnifiedCartItem` 타입으로 단일 테이블 통합.

```typescript
interface UnifiedCartItem {
  key: string;
  type: 'approved' | 'direct';
  origin: 'approved' | 'low_stock' | 'manual';
  // ... 공통 필드
}
```

### 구분 뱃지
- 🔵 **승인됨** — 팀원 구매요청 승인 시 자동 추가
- 🔴 **재고부족** — 재고 0 칼럼 자동 추가  
- ⚪ **수동추가** — 관리자 직접 추가

### 발주 처리
- 승인됨 → `PATCH /api/requests/{id}` `action:'order'`
- 직접발주 → `POST /api/requests` `initial_status:'ordered'`

### 변경 파일
- `src/components/CartTab.tsx` — 전면 재작성

---

## 3. 관리자 직접발주 분리

### 문제
관리자가 직접 발주한 항목이 팀원 구매요청 탭에도 섞여 표시됨.

### 해결
DB에 `is_admin_direct BOOLEAN` 컬럼 추가.

```sql
ALTER TABLE purchase_requests 
ADD COLUMN IF NOT EXISTS is_admin_direct BOOLEAN NOT NULL DEFAULT FALSE;
```

### 변경 파일
| 파일 | 내용 |
|------|------|
| `src/types/index.ts` | `PurchaseRequest`에 `is_admin_direct: boolean` 추가 |
| `src/components/RequestsPanel.tsx` | `!r.is_admin_direct` 필터링 |
| `src/app/api/requests/route.ts` | POST 시 `is_admin_direct` 값 설정 |

---

## 4. 입고확인 4종 복구

### 문제
관리자가 구매요청 탭에서 직접발주 4건을 삭제하니 입고확인 탭에서도 사라짐 (같은 레코드였기 때문).

### 해결
`purchase_status='발주 완료'`인데 ordered 구매요청이 없는 칼럼 찾아 DB에 직접 INSERT로 복구.

```sql
INSERT INTO purchase_requests 
  (column_model_id, requested_by, quantity, status, is_admin_direct, ...)
VALUES
  ('5a651fe8-...', '관리자', 2, 'ordered', true, ...),
  -- 4건 복구
```

---

## 5. 장바구니 중복 방지

### 문제
1. 재고 0 칼럼 → "재고부족"으로 자동 추가됨
2. 같은 칼럼의 팀원 구매요청 승인 → "승인됨"으로 또 추가됨 → **중복 2개**

### 해결 (3단계)

**① 초기화 시**: 전체 구매요청 fetch → pending/approved 있는 칼럼은 자동 추가 금지
```typescript
const activeRequestColIds = new Set(
  allRequests
    .filter(r => ['pending', 'approved'].includes(r.status))
    .map(r => r.column_model_id)
);
```

**② 승인 동기화 시**: 새로 승인됨 추가 시 같은 칼럼의 direct 항목 제거
```typescript
const newApprovedColIds = new Set(newApproved.map(i => i.columnModelId));
const deduped = kept.filter(i => 
  i.type !== 'direct' || !newApprovedColIds.has(i.columnModelId)
);
```

**③ 재고 0 동기화 시**: approvedRequests에 있는 칼럼 제외

---

## 6. 팀원용 랜딩 페이지

### 문제
`/` 접속 시 `/dashboard`로 리다이렉트되어 팀원이 무엇을 해야 할지 불명확.

### 해결
3개 메뉴 카드가 있는 랜딩 페이지로 교체.

### 신규 페이지
| 경로 | 내용 |
|------|------|
| `/` | 랜딩 페이지 — 재고조회 / 구매요청 / 관리자모드 카드 |
| `/stock` | 큰 검색창 + 칼럼 재고 현황 테이블 (게스트 접근 가능) |
| `/request` | 구매요청 폼 → 제출 후 구매요청 내역 화면 전환 |

### 변경/생성 파일
- `src/app/page.tsx` — 랜딩 페이지 (기존 redirect 교체)
- `src/app/stock/page.tsx` — 서버 컴포넌트
- `src/app/stock/StockClient.tsx` — 재고 조회 클라이언트
- `src/app/request/page.tsx` — 구매요청 + 내역 통합 페이지

---

## 7. 장바구니 수정 버튼

### 문제
승인됨 항목의 단가가 ₩0이거나 정보가 누락된 경우 수정할 방법이 없었음.

### 해결
각 행에 연필(✏️) 수정 버튼 추가 → 수정 모달 팝업.

### 수정 모달 구성
| 영역 | 내용 |
|------|------|
| 상단 파란 박스 (승인됨만) | 요청자·Cat.No·요청수량·요청사유 원본 (읽기 전용) |
| Cat. No / 모델명 | ✏️ 편집 가능 |
| 사이즈 / 입자크기 | ✏️ 편집 가능 |
| 수량 / 단가 | ✏️ 편집 가능 (단가 0원이면 "미입력" 경고) |
| KEP코드 / 긴급도 | ✏️ 편집 가능 |
| 구매사유 | ✏️ 편집 가능 |
| 하단 | 예상 합계 실시간 미리보기 |

### 변경 파일
- `src/components/CartTab.tsx` — 수정 모달 추가, `UnifiedCartItem`에 `size`/`particleSize` 필드 추가

---

## 8. 텔레그램 알림

### 기능
팀원이 구매요청 제출 시 관리자 텔레그램으로 즉시 알림 발송.

### 알림 메시지 형식
```
🛒 새 구매요청이 접수되었습니다

📦 칼럼: Inno Column C18-sb
🗒️ Cat. No: 05NSB04625
👤 요청자: 김광태
📊 수량: 1개
📝 사유: 아세틸시스테인_유기불순물
⏰ 시간: 2026. 6. 1. 오후 2:30:00
```

### 구현 방식
외부 패키지 없이 `fetch`로 Telegram Bot API 직접 호출.

```typescript
// src/lib/telegram.ts
export async function sendTelegramMessage(text: string): Promise<void> {
  if (!TOKEN || !CHAT_ID) return; // 환경변수 없으면 스킵
  await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: CHAT_ID, text, parse_mode: 'HTML' }),
  });
}
```

### 알림 조건
- ✅ `status === 'pending'` 구매요청 생성 시
- ❌ 관리자 직접발주(`is_admin_direct`) 제외

### 환경변수
| 변수 | 값 |
|------|-----|
| `TELEGRAM_BOT_TOKEN` | BotFather에서 발급 |
| `TELEGRAM_CHAT_ID` | getUpdates API로 확인 |

### 봇 정보
- 봇: `@column_hooon_bot`
- Chat ID: `8808750951` (getUpdates의 `chat.id`, `update_id`와 다름 주의)

### 변경/생성 파일
- `src/lib/telegram.ts` — 신규 생성
- `src/app/api/requests/route.ts` — pending 생성 후 알림 호출 추가

---

---

## [2026-06-19] 재고 실사 동기화 (수동 DB 수정)

### 배경
실물 수량조사 결과와 시스템 재고를 전수 비교.

### 수량 불일치 수정 (5건)
| Cat. No | 모델명 | 수정 전 | 수정 후 |
|---------|--------|---------|---------|
| `61504` | CAPCELL PAK C18 UG120 | 4 | 3 |
| `00D-4723-Y0` | Kinetex F5 | 3 | 2 |
| `959990-906` | ZORBAX Eclipse Plus C8 | 3 | 2 |
| `959990-912` | ZORBAX Eclipse Plus Phenyl-Hexyl | 1 | 2 |
| `993967-902` | ZORBAX Eclipse XDB-C18 | 2 | 3 |

### 실물 미확인 항목 재고 0 처리 (7건)
`00F-4256-E0`, `00G-4252-E0`, `00H-0130-K0`, `59247-U`, `718966`, `PSS839853`, `WAT066220`

---

## [2026-06-19] 장바구니 단가 수정 시 대시보드 자동 동기화

### 배경
칼럼 금액이 변동될 때 장바구니에서 단가를 수정해도 대시보드(column_models) 단가는 따로 업데이트해야 했음.

### 변경 파일
#### `src/components/CartTab.tsx`
- `saveEdit()`를 `async` 함수로 변경
- 단가(`unitPrice`)가 실제로 변경된 경우에만 `PATCH /api/columns/[columnModelId]` 호출
- 성공 시 "단가가 장바구니와 대시보드에 반영되었습니다" 안내 메시지 표시

---

## [2026-06-19] 길이/내경 칼럼 파싱 순서 수정

### 배경
HPLC 칼럼 사이즈 표기: `"4.6mm x 250mm"` = 내경(4.6) × 길이(250)
기존 `parseSize()`가 첫 번째 숫자를 길이, 두 번째를 내경으로 잘못 파싱하여 뒤바뀌어 표시됨.

### 변경 파일
#### `src/components/ColumnTable.tsx`
```ts
// 수정 전 (잘못됨)
return { length: Number(nums[0]), inner: Number(nums[1]) };
// 수정 후
return { length: Number(nums[1]), inner: Number(nums[0]) };
```

---

## [2026-06-10] 칼럼 숨김 처리 + 대시보드 삭제를 soft delete로 변경

### 배경
`92475` CAPCELL PAK C18 MGII 대시보드 삭제 시 cascade로 구매요청·입고기록 전체 영구 소실.
1회성 구매 칼럼 등 재고 0 유지가 필요한 경우를 위해 "숨기기" 기능 도입.

### DB 마이그레이션 (Supabase)
```sql
ALTER TABLE column_models ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT false;
```

### 변경 파일
| 파일 | 내용 |
|------|------|
| `src/types/index.ts` | `ColumnModel`에 `is_hidden: boolean` 추가 |
| `src/app/api/columns/[id]/route.ts` | DELETE → `is_hidden=true` soft delete. 관련 pending/approved 구매요청 자동 취소 |
| `src/app/api/columns/route.ts` | GET에 `.eq('is_hidden', false)` 필터 추가 |
| `src/app/api/stats/route.ts` | 통계 쿼리에 `.eq('is_hidden', false)` 필터 추가 |
| `src/app/admin/AdminClient.tsx` | 칼럼 수정 모달에 "대시보드에서 숨기기" 버튼 추가 (EyeOff 아이콘) |

### 숨김 시 자동 처리
- `purchase_required=false`, `purchase_status=null`, `purchase_quantity=null`, `order_date=null` 초기화
- 해당 칼럼의 `pending`/`approved` 구매요청 → `rejected` 자동 전환

---

## [2026-06-10] 92475 칼럼 데이터 복원 (Supabase 직접 INSERT)

activity_logs 기반으로 삭제된 데이터 수동 복원.

| 테이블 | 복원 내용 |
|--------|-----------|
| `column_models` | UUID `084949d4-...`, CAPCELL PAK C18 MGII, cat_no=92475, size="3.0mm x 100mm", unit_price=554000, total_stock=0 |
| `purchase_requests` | 이원재, qty=1, 2026-05-21, status='received' |
| `receiving_records` | qty=1, 2026-06-10, unit_price=554000, total_price=554000 |
- 중복 구매요청 2건 (2026-05-22) 삭제

---

## [2026-06-05] 대시보드 칼럼 테이블 — 사이즈 분리 + Excel 스타일 필터

### 배경
기존 "사이즈" 단일 칼럼을 내경(MM)/길이(MM)으로 분리, 필터 기능 추가 요청.

### 변경 파일
#### `src/components/ColumnTable.tsx` (전면 개편)
- `parseSize()` 유틸 함수 추가: `"4.6mm x 250mm"` → `{ inner: 4.6, length: 250 }`
- 기존 "사이즈" 칼럼 → "길이(MM)" + "내경(MM)" 2개 칼럼으로 분리
- `MultiSelectFilter` 컴포넌트: 팝오버 + 전체선택 + 검색 + 개별 체크박스
- 필터 대상: 길이(MM), 내경(MM), 입자(µm)
- 필터 상태 `localStorage` 저장/복원 (`hplc_column_filter` 키)
- 정렬 기능 없음 (사용자 요청으로 제외)

---

## [2026-06-01] 장바구니 수정 사항 영구 저장 + 입고확인 금액 동기화

### 문제
- 승인됨 항목을 수정(단가·수량)해도 새로고침 시 원복됨
- 발주완료 시 수정된 단가가 아닌 원래 단가로 입고확인 금액이 계산됨

### 변경 파일
#### `src/components/CartTab.tsx`
- `APPROVED_EDITS_KEY = 'hplc_cart_approved_edits'` localStorage 키 추가
- 수정 저장 시 `purchaseRequestId` 기준으로 override 저장
- 새로고침 후 approvedRequests 동기화 시 override 자동 복원
- 발주 완료 처리 후 localStorage override 정리

#### `src/app/api/columns/[id]/route.ts`
- `order` 액션 PATCH 시 `quantity`, `unit_price` body 파라미터 반영

---

## 커밋 히스토리 요약

| 커밋 | 내용 |
|------|------|
| `984455f` | fix: separate admin-direct orders from team purchase requests |
| `eb85fdf` | 장바구니 통합: 섹션 A/B → 단일 UnifiedCartItem 목록 |
| `f2faa31` | 팀원용 랜딩 페이지 + 재고조회/구매요청 전용 화면 추가 |
| `2b5d30a` | fix: 장바구니 중복 항목 방지 - 승인 시 재고부족 항목 자동 제거 |
| `8b4ad65` | fix: 구매요청(pending/approved) 있는 칼럼 장바구니 자동추가 완전 차단 |
| `5bf6410` | feat: 장바구니 항목 수정 버튼 추가 |
| `22a8f4f` | feat: 장바구니 수정 모달 - 구매요청 원본 정보 + 칼럼 상세 통합 |
| `51ea6b2` | fix: 수정 모달 Cat.No/모델명 편집 가능하게 변경 |
| `d7bf01d` | feat: 구매요청 텔레그램 알림 추가 |

---

## 환경 설정

### `.env.local`
```
NEXT_PUBLIC_SUPABASE_URL=https://ashdwpxtdklbnoediyiy.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
JWT_SECRET=...
ADMIN_USERNAME=16242
ADMIN_PASSWORD=...
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=8808750951
```

### Vercel 환경변수
위 항목 중 `NODE_TLS_REJECT_UNAUTHORIZED` 제외하고 모두 등록.

### Supabase 프로젝트
- ID: `ashdwpxtdklbnoediyiy`
- 리전: `ap-northeast-2` (서울)
