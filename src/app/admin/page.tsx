import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import AdminClient from './AdminClient';

export default async function AdminPage() {
  const session = await getSession();
  if (!session || session.type !== 'admin') redirect('/');

  return <AdminClient adminName={(session as any).name} username={(session as any).username} />;
}
