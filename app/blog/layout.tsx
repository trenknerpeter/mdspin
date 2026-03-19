import { Metadata } from 'next'
import { SITE_URL } from '@/lib/seo'

export const metadata: Metadata = {
  title: 'Blog',
  description:
    'Insights on AI document processing, markdown conversion, and optimizing LLM workflows.',
  alternates: {
    canonical: `${SITE_URL}/blog`,
    types: {
      'application/rss+xml': `${SITE_URL}/blog/feed.xml`,
    },
  },
}

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return children
}
