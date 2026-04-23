export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-xl rounded-lg border border-border bg-white p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-2">
          <div className="h-7 w-7 rounded-full bg-brand-pink" aria-hidden />
          <span className="font-display text-xl text-brand-navy">
            PitchFlare
          </span>
        </div>
        {children}
      </div>
    </main>
  );
}
