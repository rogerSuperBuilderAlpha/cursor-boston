import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Open Source",
  description: "Cursor Boston is open source - Explore our roadmap and find ways to contribute.",
};

// Roadmap items with categories and difficulty levels
const roadmapItems = [
  {
    category: "Features",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    color: "emerald",
    items: [
      {
        title: "Dark Mode Toggle",
        description: "Add a theme switcher to toggle between light and dark modes across the site.",
        difficulty: "beginner",
        skills: ["React", "Tailwind CSS", "localStorage"],
      },
      {
        title: "Member Search & Filters",
        description: "Add search functionality and filters (by skills, interests, location) to the members directory.",
        difficulty: "intermediate",
        skills: ["React", "Firebase", "Search"],
      },
      {
        title: "Event RSVP System",
        description: "Allow members to RSVP to events directly on the site with capacity limits and waitlists.",
        difficulty: "intermediate",
        skills: ["Firebase", "React", "Real-time"],
      },
      {
        title: "Project Showcase",
        description: "Create a gallery where members can showcase projects they've built with Cursor.",
        difficulty: "advanced",
        skills: ["Full-stack", "Firebase", "File Upload"],
      },
      {
        title: "Discussion Forum",
        description: "Build a community forum for discussions, Q&A, and knowledge sharing.",
        difficulty: "advanced",
        skills: ["Full-stack", "Real-time", "Moderation"],
      },
    ],
  },
  {
    category: "Improvements",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    ),
    color: "blue",
    items: [
      {
        title: "Improve Mobile Navigation",
        description: "Enhance the mobile menu with better animations and touch interactions.",
        difficulty: "beginner",
        skills: ["CSS", "React", "Responsive"],
      },
      {
        title: "Add Loading Skeletons",
        description: "Replace loading spinners with skeleton screens for better perceived performance.",
        difficulty: "beginner",
        skills: ["React", "CSS", "UX"],
      },
      {
        title: "Form Validation UX",
        description: "Improve form error messages with inline validation and better error states.",
        difficulty: "intermediate",
        skills: ["React", "Forms", "UX"],
      },
      {
        title: "Image Optimization",
        description: "Implement lazy loading, proper sizing, and WebP format for all images.",
        difficulty: "intermediate",
        skills: ["Next.js", "Performance", "Images"],
      },
      {
        title: "SEO Enhancements",
        description: "Add structured data, improve meta tags, and create a dynamic sitemap.",
        difficulty: "intermediate",
        skills: ["SEO", "Next.js", "Metadata"],
      },
    ],
  },
  {
    category: "Accessibility",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
      </svg>
    ),
    color: "purple",
    items: [
      {
        title: "Keyboard Navigation Audit",
        description: "Ensure all interactive elements are keyboard accessible with visible focus states.",
        difficulty: "beginner",
        skills: ["HTML", "CSS", "A11y"],
      },
      {
        title: "Screen Reader Testing",
        description: "Test with screen readers and add missing ARIA labels and landmarks.",
        difficulty: "intermediate",
        skills: ["ARIA", "Testing", "A11y"],
      },
      {
        title: "Color Contrast Check",
        description: "Audit and fix color contrast issues to meet WCAG AA standards.",
        difficulty: "beginner",
        skills: ["CSS", "Design", "A11y"],
      },
      {
        title: "Skip Links & Focus Management",
        description: "Add skip-to-content links and improve focus management on page navigation.",
        difficulty: "intermediate",
        skills: ["React", "A11y", "UX"],
      },
    ],
  },
  {
    category: "Documentation",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    color: "amber",
    items: [
      {
        title: "Component Documentation",
        description: "Document reusable components with usage examples and prop descriptions.",
        difficulty: "beginner",
        skills: ["Writing", "React", "Docs"],
      },
      {
        title: "API Documentation",
        description: "Create documentation for API routes and Firebase data structures.",
        difficulty: "intermediate",
        skills: ["Writing", "API", "Firebase"],
      },
      {
        title: "Video Tutorials",
        description: "Create video walkthroughs of the codebase and contribution process.",
        difficulty: "beginner",
        skills: ["Video", "Teaching"],
      },
      {
        title: "Architecture Diagrams",
        description: "Create visual diagrams showing app architecture and data flow.",
        difficulty: "intermediate",
        skills: ["Diagramming", "Architecture"],
      },
    ],
  },
  {
    category: "DevOps & Testing",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    color: "rose",
    items: [
      {
        title: "Unit Test Coverage",
        description: "Write unit tests for utility functions and React components.",
        difficulty: "intermediate",
        skills: ["Jest", "Testing", "React"],
      },
      {
        title: "E2E Test Suite",
        description: "Create end-to-end tests for critical user flows using Playwright.",
        difficulty: "advanced",
        skills: ["Playwright", "Testing", "CI/CD"],
      },
      {
        title: "Performance Monitoring",
        description: "Set up performance monitoring and Core Web Vitals tracking.",
        difficulty: "intermediate",
        skills: ["Analytics", "Performance", "Monitoring"],
      },
      {
        title: "Error Tracking",
        description: "Implement error tracking and logging for production issues.",
        difficulty: "intermediate",
        skills: ["Monitoring", "DevOps", "Debugging"],
      },
    ],
  },
];

const difficultyConfig = {
  beginner: {
    label: "Beginner Friendly",
    color: "bg-green-500/20 text-green-400 border-green-500/30",
  },
  intermediate: {
    label: "Intermediate",
    color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  },
  advanced: {
    label: "Advanced",
    color: "bg-red-500/20 text-red-400 border-red-500/30",
  },
};

const colorConfig: Record<string, { bg: string; border: string; text: string; iconBg: string }> = {
  emerald: {
    bg: "bg-emerald-500/5",
    border: "border-emerald-500/20",
    text: "text-emerald-400",
    iconBg: "bg-emerald-500/10",
  },
  blue: {
    bg: "bg-blue-500/5",
    border: "border-blue-500/20",
    text: "text-blue-400",
    iconBg: "bg-blue-500/10",
  },
  purple: {
    bg: "bg-purple-500/5",
    border: "border-purple-500/20",
    text: "text-purple-400",
    iconBg: "bg-purple-500/10",
  },
  amber: {
    bg: "bg-amber-500/5",
    border: "border-amber-500/20",
    text: "text-amber-400",
    iconBg: "bg-amber-500/10",
  },
  rose: {
    bg: "bg-rose-500/5",
    border: "border-rose-500/20",
    text: "text-rose-400",
    iconBg: "bg-rose-500/10",
  },
};

export default function OpenSourcePage() {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="py-16 md:py-24 px-6 border-b border-neutral-800">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-500/10 rounded-2xl mb-6">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-emerald-400"
            >
              <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
              <path d="M9 18c-4.51 2-5-2-7-2" />
            </svg>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Build With Us
          </h1>
          <p className="text-xl text-neutral-400 max-w-2xl mx-auto mb-8">
            Cursor Boston is fully open source. Explore our roadmap, find something exciting to build, and make your mark.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <a
              href="https://github.com/rogerSuperBuilderAlpha/cursor-boston"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 bg-neutral-800 text-white rounded-lg font-semibold hover:bg-neutral-700 transition-colors"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
              View Repository
            </a>
            <a
              href="#roadmap"
              className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-500 text-white rounded-lg font-semibold hover:bg-emerald-400 transition-colors"
            >
              Explore Roadmap
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M5 12l7 7 7-7" />
              </svg>
            </a>
          </div>
        </div>
      </section>

      {/* Quick Stats */}
      <section className="py-8 px-6 border-b border-neutral-800 bg-neutral-950/50">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-white">GPL-3.0</div>
              <div className="text-sm text-neutral-400">License</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-white">Next.js 16</div>
              <div className="text-sm text-neutral-400">Framework</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-white">TypeScript</div>
              <div className="text-sm text-neutral-400">Language</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-white">Firebase</div>
              <div className="text-sm text-neutral-400">Backend</div>
            </div>
          </div>
        </div>
      </section>

      {/* Roadmap */}
      <section id="roadmap" className="py-12 md:py-16 px-6 border-b border-neutral-800">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-4">Contribution Roadmap</h2>
            <p className="text-lg text-neutral-400 max-w-2xl mx-auto">
              Find something that excites you. Each item includes the skills you&apos;ll use and practice.
              Click any item to start working on it.
            </p>
          </div>

          {/* Difficulty Legend */}
          <div className="flex flex-wrap justify-center gap-4 mb-10">
            {Object.entries(difficultyConfig).map(([key, config]) => (
              <div key={key} className={`px-3 py-1.5 rounded-full text-sm border ${config.color}`}>
                {config.label}
              </div>
            ))}
          </div>

          {/* Roadmap Categories */}
          <div className="space-y-8">
            {roadmapItems.map((category) => {
              const colors = colorConfig[category.color];
              return (
                <div key={category.category} className={`rounded-2xl border ${colors.border} ${colors.bg} p-6`}>
                  <div className="flex items-center gap-3 mb-6">
                    <div className={`w-10 h-10 rounded-lg ${colors.iconBg} flex items-center justify-center ${colors.text}`}>
                      {category.icon}
                    </div>
                    <h3 className="text-xl font-bold text-white">{category.category}</h3>
                    <span className="text-sm text-neutral-500">({category.items.length} ideas)</span>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    {category.items.map((item) => {
                      const difficulty = difficultyConfig[item.difficulty as keyof typeof difficultyConfig];
                      const issueTitle = encodeURIComponent(item.title);
                      const issueBody = encodeURIComponent(
                        `## Description\n${item.description}\n\n## Skills\n${item.skills.join(", ")}\n\n## Difficulty\n${difficulty.label}\n\n---\n*This issue was created from the contribution roadmap.*`
                      );
                      const issueUrl = `https://github.com/rogerSuperBuilderAlpha/cursor-boston/issues/new?title=${issueTitle}&body=${issueBody}&labels=${item.difficulty === "beginner" ? "good+first+issue" : item.difficulty === "advanced" ? "help+wanted" : "enhancement"}`;

                      return (
                        <div
                          key={item.title}
                          className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-5 hover:border-neutral-700 transition-colors group"
                        >
                          <div className="flex items-start justify-between gap-3 mb-3">
                            <h4 className="font-semibold text-white group-hover:text-emerald-400 transition-colors">
                              {item.title}
                            </h4>
                            <span className={`px-2 py-0.5 rounded-full text-xs border shrink-0 ${difficulty.color}`}>
                              {difficulty.label}
                            </span>
                          </div>
                          <p className="text-sm text-neutral-400 mb-4">{item.description}</p>
                          <div className="flex items-center justify-between">
                            <div className="flex flex-wrap gap-1.5">
                              {item.skills.map((skill) => (
                                <span
                                  key={skill}
                                  className="px-2 py-0.5 bg-neutral-800 text-neutral-400 text-xs rounded"
                                >
                                  {skill}
                                </span>
                              ))}
                            </div>
                            <a
                              href={issueUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              Start
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M7 17l9.2-9.2M17 17V7H7" />
                              </svg>
                            </a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Have Your Own Idea */}
          <div className="mt-10 bg-neutral-900 border border-neutral-800 rounded-xl p-6 text-center">
            <h3 className="text-lg font-semibold text-white mb-2">Have Your Own Idea?</h3>
            <p className="text-neutral-400 mb-4">
              Don&apos;t see what you want to build? Propose your own feature or improvement.
            </p>
            <a
              href="https://github.com/rogerSuperBuilderAlpha/cursor-boston/issues/new?template=feature_request.md"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-neutral-800 text-white rounded-lg font-medium hover:bg-neutral-700 transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Propose a Feature
            </a>
          </div>
        </div>
      </section>

      {/* How to Contribute */}
      <section className="py-12 md:py-16 px-6 border-b border-neutral-800 bg-neutral-950/50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-white mb-8 text-center">How to Contribute</h2>

          <div className="grid md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-emerald-500 text-white rounded-xl flex items-center justify-center font-bold mx-auto mb-4">
                1
              </div>
              <h3 className="font-semibold text-white mb-2">Fork & Clone</h3>
              <p className="text-sm text-neutral-400">
                Fork the repo and clone it to your local machine
              </p>
            </div>

            <div className="text-center">
              <div className="w-12 h-12 bg-emerald-500 text-white rounded-xl flex items-center justify-center font-bold mx-auto mb-4">
                2
              </div>
              <h3 className="font-semibold text-white mb-2">Pick an Idea</h3>
              <p className="text-sm text-neutral-400">
                Choose from the roadmap above or propose your own
              </p>
            </div>

            <div className="text-center">
              <div className="w-12 h-12 bg-emerald-500 text-white rounded-xl flex items-center justify-center font-bold mx-auto mb-4">
                3
              </div>
              <h3 className="font-semibold text-white mb-2">Build It</h3>
              <p className="text-sm text-neutral-400">
                Create a branch, write code, and test locally
              </p>
            </div>

            <div className="text-center">
              <div className="w-12 h-12 bg-emerald-500 text-white rounded-xl flex items-center justify-center font-bold mx-auto mb-4">
                4
              </div>
              <h3 className="font-semibold text-white mb-2">Submit PR</h3>
              <p className="text-sm text-neutral-400">
                Open a pull request and get feedback from maintainers
              </p>
            </div>
          </div>

          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <a
              href="https://github.com/rogerSuperBuilderAlpha/cursor-boston?tab=contributing-ov-file#readme"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-neutral-800 text-white rounded-lg font-medium hover:bg-neutral-700 transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Contributing Guide
            </a>
            <a
              href="https://discord.gg/Wsncg8YYqc"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#5865F2] text-white rounded-lg font-medium hover:bg-[#4752C4] transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
              </svg>
              Join Discord
            </a>
          </div>
        </div>
      </section>

      {/* Why Contribute */}
      <section className="py-12 md:py-16 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-white mb-8 text-center">Why Contribute?</h2>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-1">Build Your Portfolio</h3>
                <p className="text-neutral-400">Real contributions to a production app that you can show off to employers.</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-1">Learn Modern Tech</h3>
                <p className="text-neutral-400">Work with Next.js 16, TypeScript, Firebase, Tailwind, and AI-powered workflows.</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-1">Join the Community</h3>
                <p className="text-neutral-400">Connect with developers who share your passion for AI-powered development.</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-1">Make an Impact</h3>
                <p className="text-neutral-400">Your work helps a real community and serves as a template for others.</p>
              </div>
            </div>
          </div>

          <div className="mt-12 pt-8 border-t border-neutral-800">
            <p className="text-neutral-400 text-sm text-center">
              See also:{" "}
              <Link href="/code-of-conduct" className="text-emerald-400 hover:text-emerald-300">Code of Conduct</Link>
              {" | "}
              <Link href="/terms" className="text-emerald-400 hover:text-emerald-300">Terms of Service</Link>
              {" | "}
              <a href="https://github.com/rogerSuperBuilderAlpha/cursor-boston/blob/main/LICENSE" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:text-emerald-300">
                GPL-3.0 License
              </a>
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
