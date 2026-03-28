import { MetadataRoute } from 'next'
import { getAllPosts } from '@/lib/blog'
import { getAllGuides } from '@/lib/guides'
import { SITE_URL } from '@/lib/seo'

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = SITE_URL

  const posts = getAllPosts()
  const blogEntries: MetadataRoute.Sitemap = posts.map((post) => ({
    url: `${baseUrl}/blog/${post.slug}`,
    lastModified: new Date(post.date),
    changeFrequency: 'monthly',
    priority: 0.7,
  }))

  const guides = getAllGuides()
  const guideEntries: MetadataRoute.Sitemap = guides.map((guide) => ({
    url: `${baseUrl}/guides/${guide.slug}`,
    lastModified: new Date(guide.date),
    changeFrequency: 'monthly',
    priority: 0.8,
  }))

  return [
    {
      url: baseUrl,
      lastModified: new Date('2026-03-28'),
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${baseUrl}/auth/sign-up`,
      lastModified: new Date('2026-03-18'),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${baseUrl}/blog`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    ...blogEntries,
    {
      url: `${baseUrl}/guides`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    ...guideEntries,
    {
      url: `${baseUrl}/formats`,
      lastModified: new Date('2026-03-28'),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
  ]
}
