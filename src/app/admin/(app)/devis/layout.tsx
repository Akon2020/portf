import { QuoteTabs } from "./tabs";

export default function QuotesLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <QuoteTabs />
      {children}
    </>
  );
}
