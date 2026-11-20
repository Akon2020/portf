export default function AdminAuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center gap-3">
          <span
            aria-hidden="true"
            className="grid size-9 place-items-center rounded-[50%_50%_50%_4px] bg-brand text-lg font-bold italic text-white"
          >
            A
          </span>
          <div className="leading-tight">
            <p className="text-sm font-semibold">Isaac Akonkwa</p>
            <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
              Administration
            </p>
          </div>
        </div>
        {children}
      </div>
    </main>
  );
}
