import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import { remark } from 'remark'
import remarkHtml from 'remark-html'
import remarkGfm from 'remark-gfm'

const GUIDES_DIR = path.join(process.cwd(), 'content', 'guides')

export type Guide = {
  slug: string
  title: string
  description: string
  date: string
  author: string
  tags: string[]
  image?: string
  readingTime: number
  content: string
}

export type GuideMeta = Omit<Guide, 'content'>

function getReadingTime(text: string): number {
  return Math.max(1, Math.ceil(text.split(/\s+/).length / 200))
}

export function getAllGuides(): GuideMeta[] {
  if (!fs.existsSync(GUIDES_DIR)) return []

  const files = fs.readdirSync(GUIDES_DIR).filter((f) => f.endsWith('.md'))

  const guides = files.map((file) => {
    const slug = file.replace(/\.md$/, '')
    const raw = fs.readFileSync(path.join(GUIDES_DIR, file), 'utf-8')
    const { data, content } = matter(raw)

    return {
      slug,
      title: data.title ?? '',
      description: data.description ?? '',
      date: data.date ?? '',
      author: data.author ?? 'MDSpin Team',
      tags: data.tags ?? [],
      image: data.image,
      readingTime: getReadingTime(content),
    }
  })

  return guides.sort((a, b) => (a.date > b.date ? -1 : 1))
}

export function getGuideBySlug(slug: string): Guide | null {
  const filePath = path.join(GUIDES_DIR, `${slug}.md`)
  if (!fs.existsSync(filePath)) return null

  const raw = fs.readFileSync(filePath, 'utf-8')
  const { data, content } = matter(raw)

  return {
    slug,
    title: data.title ?? '',
    description: data.description ?? '',
    date: data.date ?? '',
    author: data.author ?? 'MDSpin Team',
    tags: data.tags ?? [],
    image: data.image,
    readingTime: getReadingTime(content),
    content,
  }
}

export function getAllGuideSlugs(): string[] {
  if (!fs.existsSync(GUIDES_DIR)) return []
  return fs
    .readdirSync(GUIDES_DIR)
    .filter((f) => f.endsWith('.md'))
    .map((f) => f.replace(/\.md$/, ''))
}

export async function guideMarkdownToHtml(markdown: string): Promise<string> {
  const result = await remark().use(remarkGfm).use(remarkHtml).process(markdown)
  return result.toString()
}
