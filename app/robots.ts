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
