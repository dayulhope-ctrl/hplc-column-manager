import { createClient } from '@supabase/supabase-js';

// 서버용 (API 라우트 - 서비스 롤 권한)
// 환경변수는 호출 시점(런타임)에 읽는다. 모듈 최상단에서 createClient를 호출하면
// 빌드의 "Collecting page data" 단계에서 env가 없을 때 "supabaseUrl is required"로 실패하므로 지연 초기화.
export function createServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });
}
