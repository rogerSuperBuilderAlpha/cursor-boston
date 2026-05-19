/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

interface Props {
  title: string;
  id?: string;
  children: React.ReactNode;
}

export function Section({ title, id, children }: Props) {
  return (
    <section id={id} className="mb-8 scroll-mt-24">
      <h2 className="text-xl font-semibold mb-3">{title}</h2>
      <div className="text-neutral-700 dark:text-neutral-300 leading-relaxed">
        {children}
      </div>
    </section>
  );
}
