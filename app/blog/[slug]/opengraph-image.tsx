import { ImageResponse } from 'next/og'
import { getPostBySlug } from '@/lib/blog'

export const runtime = 'nodejs'
export const alt = 'MDSpin Blog'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

type Props = { params: Promise<{ slug: string }> }

export default async function Image({ params }: Props) {
  const { slug } = await params
  const post = getPostBySlug(slug)
  const title = post?.title ?? 'MDSpin Blog'
  const date = post
    ? new Date(post.date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : ''

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          width: '100%',
          height: '100%',
          backgroundColor: '#0C0C0C',
          color: '#F0EDE8',
          fontFamily: 'sans-serif',
          padding: '60px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              display: 'flex',
              fontSize: 28,
              fontWeight: 800,
              color: '#FF4800',
            }}
          >
            MDSpin
          </div>
          <div
            style={{
              display: 'flex',
              fontSize: 16,
              color: '#4A4A46',
            }}
          >
            /
          </div>
          <div
            style={{
              display: 'flex',
              fontSize: 18,
              color: '#888480',
            }}
          >
            Blog
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            maxWidth: 900,
          }}
        >
          <div
            style={{
              display: 'flex',
              fontSize: 48,
              fontWeight: 700,
              lineHeight: 1.2,
              color: '#F0EDE8',
            }}
          >
            {title}
          </div>
          {date && (
            <div style={{ display: 'flex', fontSize: 18, color: '#4A4A46' }}>
              {date}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', fontSize: 16, color: '#555' }}>
          mdspin.app/blog
        </div>
      </div>
    ),
    { ...size },
  )
}
