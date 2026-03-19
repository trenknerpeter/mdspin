import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import { remark } from 'remark'
import remarkHtml from 'remark-html'
import remarkGfm from 'remark-gfm'

const BLOG_DIR = path.join(process.cwd(), 'content', 'blog')

export type BlogPost = {
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

export type BlogPostMeta = Omit<BlogPost, 'content'>

function getReadingTime(text: string): number {
  return Math.max(1, Math.ceil(text.split(/\s+/).length / 200))
}

export function getAllPosts(): BlogPostMeta[] {
  if (!fs.existsSync(BLOG_DIR)) return []

  const files = fs.readdirSync(BLOG_DIR).filter((f) => f.endsWith('.md'))

  const posts = files.map((file) => {
    const slug = file.replace(/\.md$/, '')
    const raw = fs.readFileSync(path.join(BLOG_DIR, file), 'utf-8')
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

  return posts.sort((a, b) => (a.date > b.date ? -1 : 1))
}

export function getPostBySlug(slug: string): BlogPost | null {
  const filePath = path.join(BLOG_DIR, `${slug}.md`)
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

export function getAllSlugs(): string[] {
  if (!fs.existsSync(BLOG_DIR)) return []
  return fs
    .readdirSync(BLOG_DIR)
    .filter((f) => f.endsWith('.md'))
    .map((f) => f.replace(/\.md$/, ''))
}

export async function markdownToHtml(markdown: string): Promise<string> {
  const result = await remark().use(remarkGfm).use(remarkHtml).process(markdown)
  return result.toString()
}
