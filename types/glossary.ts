/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

export interface GlossaryTerm {
  id: string; // Document ID (usually same as slug)
  term: string;
  slug: string;
  definition: string;
  category?: string;
  status: 'pending' | 'approved' | 'rejected';
  createdBy: {
    uid: string;
    name: string;
  };
  createdAt: string; // ISO String
  updatedAt: string; // ISO String
  editHistory?: Array<{
    userId: string;
    userName: string;
    timestamp: string;
    changes: string;
  }>;
}

export type GlossaryStatus = GlossaryTerm['status'];

export interface GlossarySubmission {
  term: string;
  definition: string;
  category?: string;
}
