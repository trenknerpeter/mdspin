import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Conversion History',
  description: 'View and manage your past document-to-markdown conversions.',
  robots: { index: false, follow: false },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
