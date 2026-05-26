/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

export type RoadmapDifficulty = "beginner" | "intermediate" | "advanced";

export type RoadmapCategoryKey =
  | "features"
  | "improvements"
  | "accessibility"
  | "documentation"
  | "devops-testing";

export type RoadmapIconKey =
  | "zap"
  | "refresh"
  | "eye"
  | "file-text"
  | "settings";

export interface RoadmapItem {
  title: string;
  description: string;
  difficulty: RoadmapDifficulty;
  skills: string[];
}

export interface RoadmapCategory {
  key: RoadmapCategoryKey;
  label: string;
  iconKey: RoadmapIconKey;
  accent: "emerald" | "blue" | "violet" | "amber" | "rose";
  items: RoadmapItem[];
}

/** @internal */
export interface RoadmapFilters {
  query?: string;
  category?: RoadmapCategoryKey | "all";
  difficulty?: RoadmapDifficulty | "all";
}

export const DIFFICULTY_LABELS: Record<RoadmapDifficulty, string> = {
  beginner: "Beginner Friendly",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

export const ROADMAP_CATEGORIES: readonly RoadmapCategory[] = [
  {
    key: "features",
    label: "Features",
    iconKey: "zap",
    accent: "emerald",
    items: [
      {
        title: "Dark Mode Toggle",
        description:
          "Add a theme switcher to toggle between light and dark modes across the site.",
        difficulty: "beginner",
        skills: ["React", "Tailwind CSS", "localStorage"],
      },
      {
        title: "Member Search & Filters",
        description:
          "Add search functionality and filters by skills, interests, and location to the members directory.",
        difficulty: "intermediate",
        skills: ["React", "Firebase", "Search"],
      },
      {
        title: "Event RSVP System",
        description:
          "Allow members to RSVP to events directly on the site with capacity limits and waitlists.",
        difficulty: "intermediate",
        skills: ["Firebase", "React", "Real-time"],
      },
      {
        title: "Project Showcase",
        description:
          "Create a gallery where members can showcase projects they have built with Cursor.",
        difficulty: "advanced",
        skills: ["Full-stack", "Firebase", "File Upload"],
      },
      {
        title: "Discussion Forum",
        description:
          "Build a community forum for discussions, Q&A, and knowledge sharing.",
        difficulty: "advanced",
        skills: ["Full-stack", "Real-time", "Moderation"],
      },
    ],
  },
  {
    key: "improvements",
    label: "Improvements",
    iconKey: "refresh",
    accent: "blue",
    items: [
      {
        title: "Improve Mobile Navigation",
        description:
          "Enhance the mobile menu with better animations and touch interactions.",
        difficulty: "beginner",
        skills: ["CSS", "React", "Responsive"],
      },
      {
        title: "Add Loading Skeletons",
        description:
          "Replace loading spinners with skeleton screens for better perceived performance.",
        difficulty: "beginner",
        skills: ["React", "CSS", "UX"],
      },
      {
        title: "Form Validation UX",
        description:
          "Improve form error messages with inline validation and better error states.",
        difficulty: "intermediate",
        skills: ["React", "Forms", "UX"],
      },
      {
        title: "Image Optimization",
        description:
          "Implement lazy loading, proper sizing, and WebP format for all images.",
        difficulty: "intermediate",
        skills: ["Next.js", "Performance", "Images"],
      },
      {
        title: "SEO Enhancements",
        description:
          "Add structured data, improve meta tags, and create a dynamic sitemap.",
        difficulty: "intermediate",
        skills: ["SEO", "Next.js", "Metadata"],
      },
    ],
  },
  {
    key: "accessibility",
    label: "Accessibility",
    iconKey: "eye",
    accent: "violet",
    items: [
      {
        title: "Keyboard Navigation Audit",
        description:
          "Ensure all interactive elements are keyboard accessible with visible focus states.",
        difficulty: "beginner",
        skills: ["HTML", "CSS", "A11y"],
      },
      {
        title: "Screen Reader Testing",
        description:
          "Test with screen readers and add missing ARIA labels and landmarks.",
        difficulty: "intermediate",
        skills: ["ARIA", "Testing", "A11y"],
      },
      {
        title: "Color Contrast Check",
        description:
          "Audit and fix color contrast issues to meet WCAG AA standards.",
        difficulty: "beginner",
        skills: ["CSS", "Design", "A11y"],
      },
      {
        title: "Skip Links & Focus Management",
        description:
          "Add skip-to-content links and improve focus management on page navigation.",
        difficulty: "intermediate",
        skills: ["React", "A11y", "UX"],
      },
    ],
  },
  {
    key: "documentation",
    label: "Documentation",
    iconKey: "file-text",
    accent: "amber",
    items: [
      {
        title: "Component Documentation",
        description:
          "Document reusable components with usage examples and prop descriptions.",
        difficulty: "beginner",
        skills: ["Writing", "React", "Docs"],
      },
      {
        title: "API Documentation",
        description:
          "Create documentation for API routes and Firebase data structures.",
        difficulty: "intermediate",
        skills: ["Writing", "API", "Firebase"],
      },
      {
        title: "Video Tutorials",
        description:
          "Create video walkthroughs of the codebase and contribution process.",
        difficulty: "beginner",
        skills: ["Video", "Teaching"],
      },
      {
        title: "Architecture Diagrams",
        description:
          "Create visual diagrams showing app architecture and data flow.",
        difficulty: "intermediate",
        skills: ["Diagramming", "Architecture"],
      },
    ],
  },
  {
    key: "devops-testing",
    label: "DevOps & Testing",
    iconKey: "settings",
    accent: "rose",
    items: [
      {
        title: "Unit Test Coverage",
        description: "Write unit tests for utility functions and React components.",
        difficulty: "intermediate",
        skills: ["Jest", "Testing", "React"],
      },
      {
        title: "E2E Test Suite",
        description:
          "Create end-to-end tests for critical user flows using Playwright.",
        difficulty: "advanced",
        skills: ["Playwright", "Testing", "CI/CD"],
      },
      {
        title: "Performance Monitoring",
        description:
          "Set up performance monitoring and Core Web Vitals tracking.",
        difficulty: "intermediate",
        skills: ["Analytics", "Performance", "Monitoring"],
      },
      {
        title: "Error Tracking",
        description:
          "Implement error tracking and logging for production issues.",
        difficulty: "intermediate",
        skills: ["Monitoring", "DevOps", "Debugging"],
      },
    ],
  },
] as const;

export function countRoadmapItems(
  categories: readonly RoadmapCategory[] = ROADMAP_CATEGORIES
): number {
  return categories.reduce((total, category) => total + category.items.length, 0);
}

function normalizeQuery(query: string | undefined): string {
  return query?.trim().toLowerCase() ?? "";
}

function itemMatchesQuery(item: RoadmapItem, query: string): boolean {
  if (!query) return true;
  const haystack = [
    item.title,
    item.description,
    item.difficulty,
    ...item.skills,
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
}

export function filterRoadmapCategories(
  filters: RoadmapFilters,
  categories: readonly RoadmapCategory[] = ROADMAP_CATEGORIES
): RoadmapCategory[] {
  const query = normalizeQuery(filters.query);
  return categories
    .filter(
      (category) =>
        !filters.category ||
        filters.category === "all" ||
        category.key === filters.category
    )
    .map((category) => ({
      ...category,
      items: category.items.filter(
        (item) =>
          (!filters.difficulty ||
            filters.difficulty === "all" ||
            item.difficulty === filters.difficulty) &&
          itemMatchesQuery(item, query)
      ),
    }))
    .filter((category) => category.items.length > 0);
}

export function buildRoadmapIssueUrl(item: RoadmapItem): string {
  const labels =
    item.difficulty === "beginner"
      ? "good first issue"
      : item.difficulty === "advanced"
        ? "help wanted"
        : "enhancement";
  const params = new URLSearchParams({
    title: item.title,
    body: [
      "## Description",
      item.description,
      "",
      "## Skills",
      item.skills.join(", "),
      "",
      "## Difficulty",
      DIFFICULTY_LABELS[item.difficulty],
      "",
      "---",
      "This issue was created from the contribution roadmap.",
    ].join("\n"),
    labels,
  });

  return `https://github.com/rogerSuperBuilderAlpha/cursor-boston/issues/new?${params.toString()}`;
}
