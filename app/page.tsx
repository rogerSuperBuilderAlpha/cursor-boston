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

        {/* Events Link */}
        <a
          href="https://luma.com/cursor-boston"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors text-sm font-medium"
        >
          View Past Events
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 17l9.2-9.2M17 17V7H7"/>
          </svg>
        </a>

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
