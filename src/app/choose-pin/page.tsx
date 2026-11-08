import { redirect } from 'next/navigation';
import { getAuthUser } from '@/modules/auth';
import { getRoleHome } from '@/shared/models/roles';
import { ChoosePinView } from '@/modules/auth/views/choose-pin.view';

export default async function ChoosePinPage() {
  const user = await getAuthUser();
  if (!user) redirect('/login');
  if (!user.mustChangePin) redirect(getRoleHome(user.role));
  return <ChoosePinView fullName={user.fullName} />;
}
