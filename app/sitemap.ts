/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { MetadataRoute } from 'next';
import { getAllPostSlugs } from '@/lib/blog';
import { MONTHLY_CHALLENGES } from '@/lib/monthly-challenges';
import { PROMPT_TEMPLATES } from '@/lib/prompt-templates';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://cursorboston.com';
  const sourceDateEpoch = Number.parseInt(process.env.SOURCE_DATE_EPOCH ?? '', 10);
  const lastModified = Number.isFinite(sourceDateEpoch) && sourceDateEpoch > 0
    ? new Date(sourceDateEpoch * 1000)
    : new Date();

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${baseUrl}/about`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/about-cursor`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/events`,
      lastModified,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/blog`,
      lastModified,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/hackathons`,
      lastModified,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/hackathons/hack-a-sprint-2026`,
      lastModified,
      changeFrequency: 'daily',
      priority: 0.75,
    },
    {
      url: `${baseUrl}/hackathons/hack-a-sprint-2026/signup`,
      lastModified,
      changeFrequency: 'daily',
      priority: 0.72,
    },
    {
      url: `${baseUrl}/challenges`,
      lastModified,
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/talks`,
      lastModified,
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/members`,
      lastModified,
      changeFrequency: 'weekly',
      priority: 0.6,
    },
    {
      url: `${baseUrl}/open-source`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${baseUrl}/maintainers`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.52,
    },
    {
      url: `${baseUrl}/maintainers/apply`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/cookbook`,
      lastModified,
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/templates`,
      lastModified,
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/showcase`,
      lastModified,
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/pair`,
      lastModified,
      changeFrequency: 'weekly',
      priority: 0.6,
    },
    {
      url: `${baseUrl}/badges`,
      lastModified,
      changeFrequency: 'weekly',
      priority: 0.6,
    },
    {
      url: `${baseUrl}/skills`,
      lastModified,
      changeFrequency: 'weekly',
      priority: 0.6,
    },
    {
      url: `${baseUrl}/ecosystem`,
      lastModified,
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/opportunities`,
      lastModified,
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/analytics`,
      lastModified,
      changeFrequency: 'weekly',
      priority: 0.6,
    },
    {
      url: `${baseUrl}/questions`,
      lastModified,
      changeFrequency: 'daily',
      priority: 0.7,
    },
    // Legal pages
    {
      url: `${baseUrl}/terms`,
      lastModified,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/cookies`,
      lastModified,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/disclaimer`,
      lastModified,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/code-of-conduct`,
      lastModified,
      changeFrequency: 'yearly',
      priority: 0.4,
    },
    {
      url: `${baseUrl}/accessibility`,
      lastModified,
      changeFrequency: 'yearly',
      priority: 0.4,
    },
  ];

  // Dynamic blog posts
  const blogSlugs = getAllPostSlugs();
  const blogPages: MetadataRoute.Sitemap = blogSlugs.map((slug) => ({
    url: `${baseUrl}/blog/${slug}`,
    lastModified,
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }));

  const challengePages: MetadataRoute.Sitemap = MONTHLY_CHALLENGES.map((challenge) => ({
    url: `${baseUrl}/challenges/${challenge.id}`,
    lastModified,
    changeFrequency: challenge.status === 'current' ? 'weekly' : 'monthly',
    priority: challenge.status === 'current' ? 0.68 : 0.5,
  }));

  const templatePages: MetadataRoute.Sitemap = PROMPT_TEMPLATES.map((template) => ({
    url: `${baseUrl}/templates/${template.id}`,
    lastModified,
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }));

  return [...staticPages, ...blogPages, ...challengePages, ...templatePages];
}
