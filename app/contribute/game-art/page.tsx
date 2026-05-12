/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { getRepoUrl } from "@/lib/github-edit-link";

export const metadata: Metadata = {
  title: "Add art to the game · Cursor Boston",
  description:
    "How designers can contribute artwork for the Cursor Boston game — units, spells, castes, buildings, upgrades, and artifacts — and open a pull request.",
};

const REPO = getRepoUrl();
const CATALOG_BROWSE_BASE = `${REPO}/tree/develop/lib/game/content`;
const PUBLIC_BROWSE_BASE = `${REPO}/tree/develop/public/game`;

interface Category {
  key: string;
  label: string;
  /** Path relative to /public where PNGs live. */
  publicPath: string;
  /** Folder under lib/game/content that holds the catalog source-of-truth. */
  catalogPath: string;
  /** Naming pattern (concrete examples below). */
  pattern: string;
  examples: string[];
}

const CATEGORIES: Category[] = [
  {
    key: "castes",
    label: "Castes",
    publicPath: "/public/game/castes/",
    catalogPath: "lib/game/content/castes.ts",
    pattern: "<caste>.png",
    examples: ["white.png", "blue.png", "green.png", "red.png", "black.png"],
  },
  {
    key: "units",
    label: "Units",
    publicPath: "/public/game/units/",
    catalogPath: "lib/game/content/units/",
    pattern: "<id>.png  (where id is `<caste>-<type>-<name>`)",
    examples: [
      "white-ground-pikeman.png",
      "blue-air-sky-reader.png",
      "green-ground-warden.png",
      "red-air-phoenix-talon.png",
      "black-siege-bone-hurler.png",
    ],
  },
  {
    key: "spells",
    label: "Spells",
    publicPath: "/public/game/spells/",
    catalogPath: "lib/game/content/spells/",
    pattern: "<id>.png  (where id is `<caste>-<school>-<name>`)",
    examples: [
      "white-offense-smite.png",
      "blue-defense-arcane-veil.png",
      "black-attrition-bone-fever.png",
      "red-production-forge-blessing.png",
      "green-disarm-binding-roots.png",
    ],
  },
  {
    key: "buildings",
    label: "Buildings",
    publicPath: "/public/game/buildings/",
    catalogPath: "lib/game/content/buildings/",
    pattern: "<id>.png  (typically `<caste>-<kind>` or shared `<kind>`)",
    examples: ["white-military.png", "blue-magic.png", "green-food.png"],
  },
  {
    key: "upgrades",
    label: "Upgrades",
    publicPath: "/public/game/upgrades/",
    catalogPath: "lib/game/content/upgrades/",
    pattern: "<id>.png  (matches the upgrade target id + tier)",
    examples: ["white-ground-pikeman-upgrade-1.png"],
  },
  {
    key: "artifacts",
    label: "Artifacts",
    publicPath: "/public/game/artifacts/",
    catalogPath: "lib/game/content/artifacts/",
    pattern: "<id>.png  (matches the artifact id from the catalog)",
    examples: ["rare-stormglass-ward.png"],
  },
];

export default function ContributeGameArtPage() {
  return (
    <main className="min-h-screen bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <div className="mx-auto max-w-3xl px-6 py-12 md:py-16">
        <nav className="mb-8 text-sm text-neutral-500 dark:text-neutral-400">
          <Link href="/" className="hover:text-emerald-600 dark:hover:text-emerald-400">
            Home
          </Link>
          <span className="mx-2">/</span>
          <span className="text-neutral-700 dark:text-neutral-300">
            Contribute game art
          </span>
        </nav>

        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
          Add art to the Cursor Boston game
        </h1>
        <p className="mt-4 text-base text-neutral-600 dark:text-neutral-400">
          The game catalog has slots for hundreds of images — units, spells,
          buildings, upgrades, castes, and artifacts. Most ship today without
          art and fall back to a placeholder logo. <strong>Your PR replaces the
          placeholder for every player on the next page load.</strong> No code
          changes needed; the catalogs already wire each entry&apos;s image by
          convention. Drop a PNG in the right folder with the matching
          filename and you&apos;re done.
        </p>

        <Section id="what-we-need" title="What we need">
          <p className="text-sm text-neutral-700 dark:text-neutral-300">
            Each catalog entry has an <code className="rounded bg-neutral-200 px-1 py-0.5 text-xs dark:bg-neutral-800">id</code>. The
            UI looks for <code className="rounded bg-neutral-200 px-1 py-0.5 text-xs dark:bg-neutral-800">/game/&lt;category&gt;/&lt;id&gt;.png</code> in
            the <code className="rounded bg-neutral-200 px-1 py-0.5 text-xs dark:bg-neutral-800">public/</code> tree. Match the id exactly
            and the image is automatically picked up — there&apos;s nothing to
            register or import.
          </p>

          <ul className="mt-6 space-y-5">
            {CATEGORIES.map((c) => (
              <li
                key={c.key}
                className="rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900"
              >
                <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
                  <h3 className="text-lg font-semibold">{c.label}</h3>
                  <code className="text-xs text-neutral-500">
                    {c.publicPath}
                  </code>
                </div>
                <p className="mt-2 text-sm text-neutral-700 dark:text-neutral-300">
                  Filename: <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs dark:bg-neutral-800">{c.pattern}</code>
                </p>
                <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
                  Examples:{" "}
                  {c.examples.map((e, i) => (
                    <span key={e}>
                      <code className="rounded bg-neutral-100 px-1 py-0.5 dark:bg-neutral-800">
                        {e}
                      </code>
                      {i < c.examples.length - 1 ? ", " : ""}
                    </span>
                  ))}
                </p>
                <p className="mt-3 text-xs">
                  <a
                    href={`${CATALOG_BROWSE_BASE}/${c.catalogPath.replace(
                      /^lib\/game\/content\//,
                      ""
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-emerald-700 underline hover:text-emerald-600 dark:text-emerald-400"
                  >
                    Browse the {c.label.toLowerCase()} catalog on GitHub →
                  </a>
                </p>
              </li>
            ))}
          </ul>
        </Section>

        <Section id="style-notes" title="Style notes">
          <ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-neutral-700 dark:text-neutral-300">
            <li>
              <strong>Format:</strong> PNG with transparent background. The
              UI composites your image over various card backgrounds.
            </li>
            <li>
              <strong>Square aspect ratio.</strong> Most game UI surfaces
              render images in a square slot. Suggested working size is
              512×512 or 1024×1024; the UI will downscale.
            </li>
            <li>
              <strong>Caste palette.</strong> Match the existing caste color
              language where it makes sense — white reads as paladin /
              cathedral, blue as arcane, green as druidic / wild, red as
              forge / fire, black as shadow / undead. Stylistic riffs are
              welcome; you don&apos;t have to mimic any one reference.
            </li>
            <li>
              <strong>Readable at small sizes.</strong> Cards render at
              ~80–120 px in many places; avoid tiny details that disappear.
            </li>
            <li>
              <strong>License.</strong> The repo is GPL-3.0. By submitting a
              PR you certify the work is yours (or compatibly licensed) and
              you&apos;re fine with it shipping under the project license.
              See <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs dark:bg-neutral-800">LICENSE</code> at the repo root.
            </li>
          </ul>
        </Section>

        <Section id="how-to-pr" title="How to submit a PR">
          <ol className="mt-2 list-decimal space-y-3 pl-5 text-sm text-neutral-700 dark:text-neutral-300">
            <li>
              Fork{" "}
              <a
                href={REPO}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-emerald-700 underline hover:text-emerald-600 dark:text-emerald-400"
              >
                rogerSuperBuilderAlpha/cursor-boston
              </a>{" "}
              and clone your fork locally.
            </li>
            <li>
              Create a branch with a designer-friendly name, e.g.{" "}
              <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs dark:bg-neutral-800">art/your-handle-white-ground-set</code>.
            </li>
            <li>
              Drop your PNGs into the matching{" "}
              <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs dark:bg-neutral-800">public/game/&lt;category&gt;/</code>{" "}
              folder. The folder may not exist yet — go ahead and create it
              if needed. Each filename must exactly match the catalog{" "}
              <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs dark:bg-neutral-800">id</code>{" "}
              with a <code>.png</code> extension. (See the GitHub links above
              for the catalog ids.)
            </li>
            <li>
              Commit with a sign-off (the project requires DCO):{" "}
              <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs dark:bg-neutral-800">git commit -s -m &quot;feat(game/art): add white ground unit set&quot;</code>.
            </li>
            <li>
              Push and open a PR against{" "}
              <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs dark:bg-neutral-800">develop</code>. Drop a couple of preview
              thumbnails in the PR description so reviewers can eyeball the
              set without checking out the branch.
            </li>
          </ol>

          <div className="mt-5 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
            <p className="font-semibold">Submit in batches when you can</p>
            <p className="mt-1">
              A full caste set (e.g. all 9 white units + a few spells) is
              easier to review than a single one-off. Open a draft PR early
              if you want feedback on naming or palette before you polish a
              batch.
            </p>
          </div>

          <p className="mt-5 text-sm text-neutral-700 dark:text-neutral-300">
            Full code-contribution flow (DCO sign-off, commit message
            conventions, what to expect on review) lives in{" "}
            <a
              href={`${REPO}/blob/develop/docs/FIRST_CONTRIBUTION.md`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-emerald-700 underline hover:text-emerald-600 dark:text-emerald-400"
            >
              docs/FIRST_CONTRIBUTION.md
            </a>{" "}
            — same rules apply to art PRs.
          </p>
        </Section>

        <Section id="what-happens-next" title="What happens when your art lands">
          <p className="mt-2 text-sm text-neutral-700 dark:text-neutral-300">
            Once your PR merges, the next time a player opens the recruit,
            spells, threats, attack, or community panels they&apos;ll see your
            artwork instead of the placeholder logo. There&apos;s no cache
            bust or migration step — the catalog already references{" "}
            <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs dark:bg-neutral-800">/game/&lt;category&gt;/&lt;id&gt;.png</code>{" "}
            for every entry; your file just fills in the slot.
          </p>
          <p className="mt-3 text-sm text-neutral-700 dark:text-neutral-300">
            You&apos;ll show up in{" "}
            <Link
              href="/contributors"
              className="font-medium text-emerald-700 underline hover:text-emerald-600 dark:text-emerald-400"
            >
              CONTRIBUTORS
            </Link>{" "}
            once your PR merges.
          </p>
        </Section>

        <Section id="questions" title="Questions?">
          <p className="mt-2 text-sm text-neutral-700 dark:text-neutral-300">
            Open an issue on the{" "}
            <a
              href={`${REPO}/issues/new`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-emerald-700 underline hover:text-emerald-600 dark:text-emerald-400"
            >
              repo
            </a>{" "}
            or email{" "}
            <a
              href="mailto:hello@cursorboston.com"
              className="font-medium text-emerald-700 underline hover:text-emerald-600 dark:text-emerald-400"
            >
              hello@cursorboston.com
            </a>
            . Browse what&apos;s already in{" "}
            <a
              href={PUBLIC_BROWSE_BASE}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-emerald-700 underline hover:text-emerald-600 dark:text-emerald-400"
            >
              public/game/
            </a>{" "}
            to see what&apos;s already covered.
          </p>
        </Section>
      </div>
    </main>
  );
}

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="mt-12">
      <h2 className="text-xl font-semibold tracking-tight md:text-2xl">
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}
