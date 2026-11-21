import { MonitoringTabs } from "@/components/admin/monitoring";

export default function MonitoringLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <MonitoringTabs />
      {children}
    </>
  );
}
