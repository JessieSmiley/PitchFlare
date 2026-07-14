import Link from "next/link";
import Image from "next/image";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-brand-mist px-4">
      <div className="max-w-md text-center">
        <Image
          src="/logo-mark.png"
          alt=""
          width={56}
          height={56}
          className="mx-auto mb-5 h-14 w-14"
        />
        <h1 className="text-5xl font-bold tracking-tight text-brand-navy">
          404
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          That page is off the campaign map. Head back to the dashboard.
        </p>
        <Link
          href="/dashboard"
          className="mt-5 inline-block rounded-lg bg-brand-pink px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-pink-deep"
        >
          Back to dashboard
        </Link>
      </div>
    </main>
  );
}
