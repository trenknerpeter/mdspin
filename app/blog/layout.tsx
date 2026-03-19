import { Metadata } from 'next'
import { SITE_URL } from '@/lib/seo'

export const metadata: Metadata = {
  title: 'Blog',
  description:
    'Insights on AI document processing, markdown conversion, and optimizing LLM workflows.',
  alternates: {
    canonical: `${SITE_URL}/blog`,
  },
}

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return children
}
