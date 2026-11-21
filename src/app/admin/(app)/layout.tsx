import { AdminShell } from "@/components/admin/shell/admin-shell";
import { requireAdmin } from "@/server/auth/guards";
import { adminCounters } from "@/server/content/admin-queries";
import { adminAvatarUrl } from "@/server/services/viewer";

export default async function AdminAppLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireAdmin();
  const [counters, avatarUrl] = await Promise.all([adminCounters(), adminAvatarUrl()]);
  return (
    <AdminShell user={{ name: user.name, email: user.email, avatarUrl }} counters={counters} year={new Date().getFullYear()}>
      {children}
    </AdminShell>
  );
}
