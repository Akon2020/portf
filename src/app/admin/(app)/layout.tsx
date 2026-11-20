import { AdminShell } from "@/components/admin/shell/admin-shell";
import { requireAdmin } from "@/server/auth/guards";
import { adminCounters } from "@/server/content/admin-queries";

export default async function AdminAppLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireAdmin();
  const counters = await adminCounters();
  return (
    <AdminShell user={{ name: user.name, email: user.email }} counters={counters} year={new Date().getFullYear()}>
      {children}
    </AdminShell>
  );
}
