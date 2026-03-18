import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sign Up',
  description: 'Create a free MDSpin account to save your document conversions and track usage.',
  alternates: { canonical: '/auth/sign-up' },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
