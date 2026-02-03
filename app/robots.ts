import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/hackathons/team/', '/hackathons/pool/'],
      },
    ],
    sitemap: 'https://cursorboston.com/sitemap.xml',
  };
}
