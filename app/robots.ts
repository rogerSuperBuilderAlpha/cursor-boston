/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/live/', '/hackathons/team/', '/hackathons/pool/', '/profile', '/hackathons/hack-a-sprint-2026/signup', '/agents/claim/'],
      },
    ],
    sitemap: 'https://cursorboston.com/sitemap.xml',
  };
}
