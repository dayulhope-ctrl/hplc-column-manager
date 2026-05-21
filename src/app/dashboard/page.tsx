import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import DashboardClient from './DashboardClient';

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect('/');

  const userName = session.type === 'admin' 
    ? (session as any).username 
    : (session as any).user_name;
  const isAdmin = session.type === 'admin';

  return <DashboardClient userName={userName} isAdmin={isAdmin} />;
}
