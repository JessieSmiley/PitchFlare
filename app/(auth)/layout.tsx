import Link from "next/link";
import Image from "next/image";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-brand-mist px-4 py-12">
      <Link href="/" className="flex flex-col items-center">
        <Image
          src="/logo.png"
          alt="PitchFlare — Ignite your strategy. From pitch to placement."
          width={140}
          height={142}
          priority
        />
      </Link>
      {children}
    </main>
  );
}
