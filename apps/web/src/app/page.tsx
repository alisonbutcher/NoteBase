import { redirect } from 'next/navigation';
import { todayISO } from '@/lib/utils';

export default function Home() {
  redirect(`/daily/${todayISO()}`);
}
