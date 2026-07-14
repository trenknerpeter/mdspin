// Registry for /convert/[slug] landing pages — tool-first SEO pages that pair
// a specific conversion intent ("png to markdown") with the embedded converter.
// Adding a new page = adding an entry here; the route renders everything else.

export type ConvertPageFaq = {
  question: string
  answer: string
}

export type ConvertPageSection = {
  heading: string
  paragraphs: string[]
  bullets?: string[]
}

export type ConvertPage = {
  slug: string
  metaTitle: string
  metaDescription: string
  // Short copy for site-wide navigation (Resources → Free tools).
  navLabel: string
  navDescription: string
  eyebrow: string
  h1: string
  // Direct-answer intro, rendered right under the H1. Keep it under ~300 words
  // and make the first sentence answer the query on its own.
  intro: string[]
  converterEyebrow: string
  converterHeading: string
  converterSubheading: string
  steps: { title: string; description: string }[]
  sections: ConvertPageSection[]
  faqs: ConvertPageFaq[]
  related: { href: string; label: string }[]
  dateModified: string
}

export const CONVERT_PAGES: ConvertPage[] = [
  {
    slug: 'image-to-markdown',
    metaTitle: 'Image to Markdown Converter — PNG & JPG to Markdown (Free AI OCR)',
    metaDescription:
      'Convert PNG and JPG images to clean Markdown online. AI vision transcribes screenshots, scanned pages, receipts, and whiteboard photos — headings, tables, and lists preserved. Free, no signup.',
    navLabel: 'Image to Markdown',
    navDescription: 'Turn PNG & JPG into clean Markdown',
    eyebrow: 'Free online tool',
    h1: 'Image to Markdown Converter',
    intro: [
      'Convert a PNG or JPG image to clean, structured Markdown in seconds. Upload a screenshot, a scanned page, a photographed receipt, or a whiteboard photo, and MDSpin transcribes the text with AI vision — keeping headings as headings, tables as Markdown tables, and lists as lists. No signup needed for a single image, and nothing to install.',
      'Traditional OCR tools give you a wall of unformatted text. MDSpin gives you Markdown that ChatGPT, Claude, and RAG pipelines can actually parse — which means better answers when you paste it into an AI chat, and cleaner chunks when you index it.',
    ],
    converterEyebrow: 'PNG · JPG · JPEG',
    converterHeading: 'Drop your image here',
    converterSubheading:
      'Upload a PNG or JPG and get clean, AI-ready Markdown in seconds.',
    steps: [
      {
        title: 'Upload your image',
        description:
          'Drag a PNG or JPG onto the converter — a screenshot, scanned page, receipt, or any photo containing text.',
      },
      {
        title: 'AI vision transcribes it',
        description:
          'MDSpin reads the image the way a person would: it detects headings, tables, lists, and reading order, then writes faithful Markdown.',
      },
      {
        title: 'Copy or save your Markdown',
        description:
          'Copy the result straight into ChatGPT or Claude, download it as a .md file, or save it to your MDSpin vault for later.',
      },
    ],
    sections: [
      {
        heading: 'Convert screenshots to Markdown',
        paragraphs: [
          'Screenshots are the most common "document" nobody can process: a table from a dashboard, a pricing page, an error message, a Slack thread, a slide from a webinar. There is no text layer to extract — copy-paste simply does not work.',
          'MDSpin transcribes the visible text and reconstructs the structure. A screenshot of a table becomes a real Markdown table you can paste into ChatGPT and ask questions about. A screenshot of documentation becomes headings and paragraphs your notes app or RAG pipeline can index.',
        ],
      },
      {
        heading: 'PNG and JPG OCR built for AI, not for print',
        paragraphs: [
          'Classic OCR (the kind built for scanning paper) outputs plain text optimized for archiving — no headings, broken tables, and hyphenated line breaks mid-sentence. That output confuses language models and wastes tokens.',
          'MDSpin uses AI vision instead of rule-based OCR. It understands document layout, so multi-column pages come out in reading order, tabular data becomes aligned Markdown tables, and heading hierarchy survives. Because the content is AI-transcribed rather than mechanically extracted, every result includes a reminder to verify accuracy for critical use.',
        ],
      },
      {
        heading: 'What people convert',
        paragraphs: [],
        bullets: [
          'Screenshots of tables, dashboards, and pricing pages for ChatGPT analysis',
          'Scanned book or contract pages sent as JPG email attachments',
          'Photographed receipts and invoices for expense workflows',
          'Whiteboard photos from workshops, turned into structured notes',
          'Slides photographed at conferences or shared as images',
        ],
      },
      {
        heading: 'Why Markdown output matters',
        paragraphs: [
          'Large language models read Markdown natively — it is the format most of their training data used for structured text. When you feed an LLM a Markdown table instead of OCR text soup, it can reference specific cells, compare rows, and summarize accurately.',
          'Markdown is also token-efficient: structure is expressed in a handful of characters instead of verbose formatting markup, so you fit more content into a context window and pay less per API call.',
        ],
      },
    ],
    faqs: [
      {
        question: 'How do I convert a PNG or JPG to Markdown?',
        answer:
          'Upload the image to the converter on this page and click Spin. MDSpin transcribes the text with AI vision and returns clean Markdown with headings, tables, and lists preserved. Copy it, download it as a .md file, or save it to your vault. A single image conversion is free and requires no signup.',
      },
      {
        question: 'Can I convert a screenshot to Markdown?',
        answer:
          'Yes — screenshots are one of the most common uses. Take a screenshot (PNG or JPG), drop it into the converter, and MDSpin transcribes the visible text into structured Markdown. Screenshots of tables become real Markdown tables you can paste into ChatGPT or Claude.',
      },
      {
        question: 'How accurate is the AI transcription?',
        answer:
          'Accuracy is high on clear, well-lit images with printed text, and the layout detection typically outperforms traditional OCR on tables and multi-column pages. Because the text is AI-transcribed rather than mechanically extracted, you should verify the output before relying on it for critical numbers, names, or legal content — every result includes a note reminding you of this.',
      },
      {
        question: 'How is this different from pasting the image into ChatGPT?',
        answer:
          'ChatGPT can describe an image, but you get a one-off answer inside a chat. MDSpin gives you the Markdown itself — a reusable, structured document you can save, index in a RAG pipeline, keep in your knowledge vault, or paste into any AI tool. Signed-in users can also convert images in batches instead of one chat message at a time.',
      },
      {
        question: 'Does it work for scanned PDFs too?',
        answer:
          'Yes. If your scan is a PDF instead of an image, upload the PDF directly — MDSpin handles both native-text PDFs and image-based pages. For a scan saved as PNG or JPG, use this image converter.',
      },
      {
        question: 'Is the image to Markdown converter free?',
        answer:
          'Yes — converting a single image is free with no signup. A free account adds batch conversion, URL conversion, saved history, and a personal vault that connects related documents automatically.',
      },
    ],
    related: [
      { href: '/guides/extract-text-from-screenshot-for-chatgpt', label: 'How to extract text from a screenshot for ChatGPT & Claude' },
      { href: '/guides/convert-pdf-for-chatgpt', label: 'How to convert PDFs for ChatGPT, Claude & Gemini' },
      { href: '/guides/document-preprocessing-for-ai', label: 'Document preprocessing for AI: the complete guide' },
      { href: '/formats', label: 'All supported formats' },
    ],
    dateModified: '2026-07-14',
  },
  {
    slug: 'word-to-markdown',
    metaTitle: 'Word to Markdown Converter — DOCX to Markdown for ChatGPT & Claude',
    metaDescription:
      'Convert Word (DOCX) documents to clean Markdown for ChatGPT, Claude, and RAG pipelines. Headings, tables, and lists preserved; tracked changes and formatting noise stripped. Free, no signup.',
    navLabel: 'Word to Markdown',
    navDescription: 'Turn DOCX into AI-ready Markdown',
    eyebrow: 'Free online tool',
    h1: 'Word to Markdown Converter',
    intro: [
      'Convert a Word document (.docx) to clean, structured Markdown in seconds — the format ChatGPT, Claude, Gemini, and RAG pipelines read best. Upload your file and MDSpin maps headings to Markdown headings, tables to Markdown tables, and lists to lists, while stripping the tracked changes, comments, and formatting metadata an AI does not need. No signup required for a single document, and nothing to install.',
      'Pasting a whole Word doc into an AI chat usually means pasting its formatting noise too — which inflates your token count and buries the actual content. Converting to Markdown first gives the model clean input, which means more accurate answers and lower cost per call.',
    ],
    converterEyebrow: 'DOCX · DOC',
    converterHeading: 'Drop your Word document here',
    converterSubheading:
      'Upload a .docx and get clean, AI-ready Markdown in seconds.',
    steps: [
      {
        title: 'Upload your Word file',
        description:
          'Drag a .docx (or .doc) onto the converter — a proposal, spec, SOP, report, or any Word document.',
      },
      {
        title: 'MDSpin converts the structure',
        description:
          'Headings, tables, and lists map to their Markdown equivalents. Tracked changes, comments, and styling metadata are stripped, leaving only the content.',
      },
      {
        title: 'Copy or save your Markdown',
        description:
          'Paste the result straight into ChatGPT or Claude, download it as a .md file, or save it to your MDSpin vault.',
      },
    ],
    sections: [
      {
        heading: 'Why convert Word to Markdown for AI?',
        paragraphs: [
          'A DOCX file is a ZIP archive of XML that encodes fonts, styles, revision history, and layout — almost none of which matters to a language model. When you hand an AI raw Word content, it spends tokens wading through that overhead instead of reasoning about your document.',
          'Markdown keeps the structure that carries meaning — headings, tables, lists — and drops everything else. The result is token-efficient input the model parses unambiguously, so it can cite the right section, read a table correctly, and answer without guessing.',
        ],
      },
      {
        heading: 'What survives the conversion',
        paragraphs: [
          'MDSpin preserves the semantic structure of your document and discards the noise:',
        ],
        bullets: [
          'Heading levels (Heading 1, 2, 3) become Markdown #, ##, ###',
          'Word tables become pipe-delimited Markdown tables with clear cell boundaries',
          'Bulleted and numbered lists keep their hierarchy',
          'Bold and italic emphasis is preserved through Markdown syntax',
          'Tracked changes, comments, and revision metadata are stripped out',
        ],
      },
      {
        heading: 'What people convert',
        paragraphs: [],
        bullets: [
          'Project specs and PRDs for AI code generation and review',
          'SOPs and internal docs for AI-powered knowledge bases',
          'Proposals and reports for AI summarization',
          'Contracts and policies for clause analysis',
          'Meeting notes and memos for RAG pipelines',
        ],
      },
      {
        heading: 'Word, ChatGPT, and Claude',
        paragraphs: [
          'ChatGPT and Claude can open Word files, but their built-in extraction is a black box — you have no control over how a complex table or multi-level list comes through, and errors are silent. Converting to Markdown first puts you in control: you see exactly what the model will receive, and you can verify it before you rely on it.',
          'The clean-input advantage compounds in RAG pipelines, where Markdown produces better chunks and more accurate retrieval than raw DOCX extraction. The same conversion that helps a one-off chat also helps an indexed knowledge base.',
        ],
      },
    ],
    faqs: [
      {
        question: 'How do I convert a Word document to Markdown?',
        answer:
          'Upload your .docx to the converter on this page and click Spin. MDSpin converts it to clean Markdown with headings, tables, and lists preserved, and strips tracked changes and formatting metadata. Copy it, download it as a .md file, or save it to your vault. A single conversion is free with no signup.',
      },
      {
        question: 'Does it preserve tables and formatting?',
        answer:
          'Yes. Heading levels, tables, and list hierarchy are mapped to their Markdown equivalents, and bold/italic emphasis is preserved. Presentational styling, tracked changes, and comments are removed, since they add token overhead without adding meaning for an AI.',
      },
      {
        question: 'Why not just paste the Word doc into ChatGPT?',
        answer:
          'You can, but you have no control over how ChatGPT extracts complex tables or nested lists, and any misread is silent. Converting to Markdown first lets you see and verify the exact text the model will receive, uses fewer tokens, and gives you a reusable file you can save or index.',
      },
      {
        question: 'Does it work with .doc as well as .docx?',
        answer:
          'Yes. MDSpin handles both the modern .docx format and legacy .doc files, converting each to clean Markdown.',
      },
      {
        question: 'Is the Word to Markdown converter free?',
        answer:
          'Yes — converting a single document is free with no signup. A free account adds batch conversion, URL conversion, saved history, and a personal vault that connects related documents automatically.',
      },
    ],
    related: [
      { href: '/guides/convert-pdf-for-chatgpt', label: 'How to convert PDFs for ChatGPT, Claude & Gemini' },
      { href: '/guides/reduce-ai-token-costs', label: 'How to cut AI token costs with better formatting' },
      { href: '/formats', label: 'All supported formats' },
    ],
    dateModified: '2026-07-14',
  },
]

export function getConvertPage(slug: string): ConvertPage | undefined {
  return CONVERT_PAGES.find((p) => p.slug === slug)
}
