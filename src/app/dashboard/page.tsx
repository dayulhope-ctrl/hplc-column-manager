import { getSession } from '@/lib/auth';
import DashboardClient from './DashboardClient';

export default async function DashboardPage() {
  const session = await getSession();

  // 세션이 있으면 이름/역할 사용, 없으면 게스트로 접근
  const userName = session
    ? (session.type === 'admin' ? (session as any).username : (session as any).user_name)
    : null;
  const isAdmin = session?.type === 'admin' ? true : false;

  return <DashboardClient userName={userName} isAdmin={isAdmin} />;
}
