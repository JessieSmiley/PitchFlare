import Image from "next/image";

export const dynamic = "force-dynamic";

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-brand-mist px-4 py-12">
      <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-2.5">
          <Image
            src="/logo-mark.png"
            alt=""
            width={32}
            height={32}
            className="h-8 w-8"
            priority
          />
          <span className="text-lg font-bold tracking-tight text-brand-navy">
            PitchFlare
          </span>
        </div>
        {children}
      </div>
    </main>
  );
}
