import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sign In',
  description: 'Sign in to MDSpin to access your conversion history and manage your account.',
  alternates: { canonical: '/auth/sign-in' },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
