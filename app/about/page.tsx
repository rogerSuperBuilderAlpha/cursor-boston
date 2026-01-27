import { Metadata } from "next";
import Image from "next/image";

export const metadata: Metadata = {
  title: "About",
  description:
    "Learn about Cursor Boston, our mission, and how to get involved with the community.",
};

const universities = [
  { name: "MIT", description: "Kendall Square innovation hub" },
  { name: "Harvard", description: "Innovation Labs & i-lab" },
  { name: "Hult International Business School", description: "Business & tech" },
  { name: "Northeastern University", description: "Co-op & tech programs" },
  { name: "Boston University", description: "Engineering & CS" },
  { name: "Boston College", description: "STEM programs" },
];

const accelerators = [
  {
    name: "MassChallenge",
    description: "Equity-free startup accelerator",
  },
  {
    name: "Techstars Boston",
    description: "Mentor-driven accelerator program",
  },
  {
    name: "The Engine",
    description: "MIT's tough tech accelerator",
  },
  {
    name: "Greentown Labs",
    description: "Climate tech incubator",
  },
];

export default function AboutPage() {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="py-16 md:py-24 px-6 border-b border-neutral-800">
        <div className="max-w-4xl mx-auto text-center">
          <div className="w-24 h-24 relative mx-auto mb-6">
            <Image
              src="/cursor-boston-logo.png"
              unoptimized
              alt="Cursor Boston"
              fill
              className="object-contain"
            />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">
            About Cursor Boston
          </h1>
          <p className="text-xl text-neutral-400 max-w-2xl mx-auto">
            A community for exploring and discussing AI-powered development with
            Cursor, right here in Beantown.
          </p>
        </div>
      </section>

      {/* Mission */}
      <section className="py-16 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-6">
            Our Mission
          </h2>
          <div className="prose prose-invert max-w-none">
            <p className="text-neutral-300 text-lg leading-relaxed mb-4">
              Cursor Boston brings together developers, designers, students,
              startup founders, and anyone curious about how AI can transform
              the way we build software.
            </p>
            <p className="text-neutral-300 text-lg leading-relaxed mb-4">
              We&apos;re part of the global{" "}
              <a
                href="https://cursor.com/community"
                target="_blank"
                rel="noopener noreferrer"
                className="text-white underline hover:text-neutral-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black rounded"
              >
                Cursor community
              </a>
              , hosting local meetups, workshops, and hackathons in the Boston
              area. Whether you&apos;re deep into your daily Cursor flow or just
              getting started with AI-assisted coding, our events are for you.
            </p>
            <p className="text-neutral-300 text-lg leading-relaxed">
              Boston has always been a hub for innovation — from world-class
              universities to cutting-edge startups. We believe AI-powered
              development tools like Cursor are the next chapter in that story,
              and we&apos;re excited to help build the community around it.
            </p>
          </div>
        </div>
      </section>

      {/* Boston Tech Ecosystem */}
      <section className="py-16 px-6 bg-neutral-950">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
            The Boston Tech Ecosystem
          </h2>
          <p className="text-neutral-400 text-lg mb-8 max-w-3xl">
            Boston is home to some of the world&apos;s most innovative
            institutions and companies. Cursor Boston connects with this vibrant
            ecosystem.
          </p>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Universities */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                  <path d="M6 12v5c3 3 9 3 12 0v-5" />
                </svg>
                Universities
              </h3>
              <div className="space-y-3">
                {universities.map((uni) => (
                  <div
                    key={uni.name}
                    className="p-4 bg-neutral-900 rounded-xl border border-neutral-800"
                  >
                    <h4 className="text-white font-medium">{uni.name}</h4>
                    <p className="text-neutral-400 text-sm">
                      {uni.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Accelerators */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
                  <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
                  <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
                  <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
                </svg>
                Accelerators & Labs
              </h3>
              <div className="space-y-3">
                {accelerators.map((acc) => (
                  <div
                    key={acc.name}
                    className="p-4 bg-neutral-900 rounded-xl border border-neutral-800"
                  >
                    <h4 className="text-white font-medium">{acc.name}</h4>
                    <p className="text-neutral-400 text-sm">
                      {acc.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Cursor Programs */}
      <section className="py-16 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
            Get Involved with Cursor
          </h2>
          <p className="text-neutral-400 text-lg mb-8 max-w-3xl">
            Beyond local events, there are opportunities to get more involved
            with the global Cursor community.
          </p>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Ambassadors */}
            <a
              href="https://cursor.com/ambassadors"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Learn about Cursor Ambassadors (opens in new tab)"
              className="bg-neutral-900 rounded-2xl p-8 border border-neutral-800 hover:border-neutral-600 transition-colors group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-white">
                  Cursor Ambassadors
                </h3>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-neutral-500 group-hover:text-white transition-colors"
                  aria-hidden="true"
                >
                  <path d="M7 17l9.2-9.2M17 17V7H7" />
                </svg>
              </div>
              <p className="text-neutral-400 leading-relaxed">
                Join us in shaping the future of development. Ambassadors
                empower the community that makes our ecosystem vibrant and
                collaborative.
              </p>
            </a>

            {/* Campus Leads */}
            <a
              href="https://cursorai.notion.site/Cursor-on-Campus-215da74ef045808d805fd336f9a62a40"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Learn about Campus Leads program (opens in new tab)"
              className="bg-neutral-900 rounded-2xl p-8 border border-neutral-800 hover:border-neutral-600 transition-colors group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-white">
                  Campus Leads
                </h3>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-neutral-500 group-hover:text-white transition-colors"
                  aria-hidden="true"
                >
                  <path d="M7 17l9.2-9.2M17 17V7H7" />
                </svg>
              </div>
              <p className="text-neutral-400 leading-relaxed">
                Represent Cursor at your school by teaching best practices,
                organizing events, and sharing Cursor with fellow students.
                Perfect for Boston-area students!
              </p>
            </a>
          </div>
        </div>
      </section>

      {/* Community */}
      <section className="py-16 px-6 bg-neutral-950">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
            Join Our Community
          </h2>
          <p className="text-neutral-400 text-lg mb-8">
            Connect with other Cursor users in Boston. Share tips, ask questions,
            and stay updated on upcoming events.
          </p>
          <a
            href="https://discord.gg/Wsncg8YYqc"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Join Cursor Boston Discord (opens in new tab)"
            className="inline-flex items-center justify-center gap-3 px-6 py-3 md:px-8 md:py-4 bg-[#5865F2] text-white rounded-lg text-base font-semibold hover:bg-[#4752C4] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5865F2] focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
            </svg>
            Join Cursor Boston Discord
          </a>
        </div>
      </section>

      {/* Contact */}
      <section className="py-16 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
            Get in Touch
          </h2>
          <p className="text-neutral-400 mb-8">
            Have questions, ideas, or want to collaborate? We&apos;d love to
            hear from you.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="mailto:hello@cursorboston.com"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white text-black rounded-lg text-sm font-semibold hover:bg-neutral-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
              hello@cursorboston.com
            </a>
            <a
              href="https://lu.ma/cursor-boston"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Subscribe on Luma (opens in new tab)"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white/10 text-white rounded-lg text-sm font-semibold hover:bg-white/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            >
              Subscribe on Luma
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M7 17l9.2-9.2M17 17V7H7" />
              </svg>
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
