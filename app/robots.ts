import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/auth/callback', '/auth/confirm', '/history'],
    },
    sitemap: 'https://mdspin.app/sitemap.xml',
  }
}
