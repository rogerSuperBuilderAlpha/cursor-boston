import Image from "next/image";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6">
      <div className="flex flex-col items-center gap-12 max-w-lg text-center">
        {/* Logo */}
        <div className="w-64 h-64 relative">
          <Image
            src="/logo.svg"
            alt="Cursor Boston"
            fill
            priority
            className="object-contain"
          />
        </div>

        {/* Coming Soon */}
        <div className="flex flex-col items-center gap-4">
          <h1 className="text-4xl font-bold tracking-widest text-white uppercase">
            Coming Soon
          </h1>
          <p className="text-lg text-neutral-400 leading-relaxed">
            A community for exploring and discussing Cursor in Boston.
          </p>
        </div>

        {/* Divider */}
        <div className="w-16 h-px bg-neutral-700" />

        {/* Footer */}
        <p className="text-sm text-neutral-500">
          Stay tuned for meetups, workshops, and more.
        </p>
      </div>
    </main>
  );
}
