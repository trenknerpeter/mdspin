import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://mdspin.app'

  return [
    {
      url: baseUrl,
      lastModified: new Date('2026-03-18'),
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${baseUrl}/auth/sign-up`,
      lastModified: new Date('2026-03-18'),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
  ]
}
