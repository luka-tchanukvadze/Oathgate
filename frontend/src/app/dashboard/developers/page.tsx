import { redirect } from 'next/navigation';

export default function DevelopersIndex() {
  redirect('/dashboard/developers/keys');
}
