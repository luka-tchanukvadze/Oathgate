import { DashboardShell } from '@/components/layout/dashboard-shell';
import { RequireSession } from '@/components/layout/require-session';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireSession>
      <DashboardShell>{children}</DashboardShell>
    </RequireSession>
  );
}
