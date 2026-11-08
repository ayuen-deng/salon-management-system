import { redirect } from 'next/navigation';

export default function RootPage() {
  // Landing page replaced by redirection to login
  redirect('/login');
}
