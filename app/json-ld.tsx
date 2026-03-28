import { SITE_URL, SITE_NAME, SITE_DESCRIPTION } from '@/lib/seo'

export function JsonLd() {
  const softwareApp = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: SITE_NAME,
    url: SITE_URL,
    applicationCategory: 'UtilitiesApplication',
    operatingSystem: 'Web',
    description: SITE_DESCRIPTION,
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    featureList: [
      'PDF to Markdown conversion',
      'DOCX to Markdown conversion',
      'PPTX to Markdown conversion',
      'AI token cost reduction',
      'RAG accuracy improvement',
    ],
  }

  const organization = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/logo.png`,
  }

  const faqPage = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'What is MDSpin?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'MDSpin is a web-based tool that converts documents (PDF, DOCX, PPTX, and more) into clean, AI-ready Markdown. It requires zero setup — just drop a file and get structured Markdown output optimized for ChatGPT, Claude, Gemini, and RAG pipelines.',
        },
      },
      {
        '@type': 'Question',
        name: 'How do I convert a PDF to markdown for AI?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Go to mdspin.app, drag and drop your PDF onto the converter, and click Spin. MDSpin extracts the content and converts it to clean Markdown that preserves headings, tables, and lists. Copy the output and paste it into ChatGPT, Claude, or any other AI tool for better responses.',
        },
      },
      {
        '@type': 'Question',
        name: 'Does markdown reduce AI token costs?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Yes. Converting documents to Markdown before sending them to AI can reduce token usage by 30-50% compared to raw PDF text or HTML. Markdown strips formatting overhead while preserving all meaningful content structure, which means lower API costs and faster inference.',
        },
      },
      {
        '@type': 'Question',
        name: 'What file formats does MDSpin support?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'MDSpin supports 8 document formats: PDF, DOCX, DOC, PPTX, Google Slides, Apple Pages, RTF, and TXT. Each format is converted to clean, structured Markdown with headings, tables, and lists preserved.',
        },
      },
      {
        '@type': 'Question',
        name: 'Is MDSpin free to use?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'MDSpin is free during the beta period. You can convert documents without any cost. Sign up for a free account to save your conversion history and get higher rate limits.',
        },
      },
      {
        '@type': 'Question',
        name: 'How does MDSpin compare to MarkItDown?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Microsoft MarkItDown is a Python library that requires installation, coding knowledge, and command-line usage. MDSpin provides the same core document-to-Markdown conversion through a zero-setup web interface — no Python, no CLI, no deployment. MDSpin also shows conversion impact metrics like token reduction and cost savings that MarkItDown does not provide.',
        },
      },
    ],
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApp) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organization) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqPage) }}
      />
    </>
  )
}
