import type { Metadata } from 'next'
import { Syne, DM_Sans, JetBrains_Mono, Instrument_Sans } from 'next/font/google'
import Script from 'next/script'
import { ConsentGate } from '@/components/consent/consent-gate'
import { AuthProvider } from '@/components/auth-provider'
import { JsonLd } from './json-ld'
import { SITE_URL, SITE_NAME, SITE_DESCRIPTION, SITE_TITLE_DEFAULT, SITE_TITLE_TEMPLATE } from '@/lib/seo'
import './globals.css'

const syne = Syne({
  subsets: ['latin'],
  variable: '--font-syne',
  weight: ['400', '500', '600', '700', '800'],
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  weight: ['400', '500'],
})

const instrumentSans = Instrument_Sans({
  subsets: ['latin'],
  variable: '--font-instrument-sans',
})

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE_DEFAULT,
    template: SITE_TITLE_TEMPLATE,
  },
  description: SITE_DESCRIPTION,
  keywords: [
    'markdown converter',
    'PDF to markdown',
    'DOCX to markdown',
    'PPTX to markdown',
    'AI document processing',
    'RAG optimization',
    'token cost reduction',
    'MDSpin',
  ],
  authors: [{ name: SITE_NAME, url: SITE_URL }],
  creator: SITE_NAME,
  icons: {
    icon: '/logo.png',
    apple: '/apple-icon.png',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: SITE_URL,
    siteName: SITE_NAME,
    title: SITE_TITLE_DEFAULT,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE_DEFAULT,
    description: SITE_DESCRIPTION,
  },
  alternates: {
    canonical: SITE_URL,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${syne.variable} ${dmSans.variable} ${jetbrainsMono.variable} ${instrumentSans.variable}`}>
      <head>
        {/*
          Usercentrics CMP. The autoblocker has to run before anything it might
          need to block, so both tags use beforeInteractive and live in <head>:
          rendered as siblings of <body> they trip a React hydration error
          ("<script> cannot be a child of <html>"). The loader reads its
          settings id off the element with id="usercentrics-cmp" — don't rename it.
        */}
        <Script src="https://web.cmp.usercentrics.eu/modules/autoblocker.js" strategy="beforeInteractive" />
        <Script
          id="usercentrics-cmp"
          src="https://web.cmp.usercentrics.eu/ui/loader.js"
          data-settings-id="IENxgYI0MpmSAk"
          strategy="beforeInteractive"
        />
      </head>
      <body className="antialiased">
        <JsonLd />
        <AuthProvider>
          {children}
        </AuthProvider>
        <ConsentGate />
      </body>
    </html>
  )
}
