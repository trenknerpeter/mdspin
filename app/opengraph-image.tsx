import { ImageResponse } from 'next/og'

export const runtime = 'nodejs'
export const alt = 'MDSpin — Convert Documents to AI-Ready Markdown'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
          backgroundColor: '#0C0C0C',
          color: '#F0EDE8',
          fontFamily: 'sans-serif',
          padding: '60px',
        }}
      >
        <div style={{ display: 'flex', fontSize: 52, fontWeight: 800, marginBottom: 24, color: '#FF4800' }}>
          MDSpin
        </div>
        <div
          style={{
            display: 'flex',
            fontSize: 38,
            fontWeight: 700,
            textAlign: 'center',
            maxWidth: 800,
            marginBottom: 48,
            lineHeight: 1.3,
          }}
        >
          Stop feeding your AI garbage.
        </div>
        <div style={{ display: 'flex', gap: 60 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ fontSize: 44, fontWeight: 800, color: '#FF4800' }}>-40%</div>
            <div style={{ fontSize: 18, color: '#888480', marginTop: 8 }}>Token Costs</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ fontSize: 44, fontWeight: 800, color: '#FF4800' }}>2.4x</div>
            <div style={{ fontSize: 18, color: '#888480', marginTop: 8 }}>Faster</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ fontSize: 44, fontWeight: 800, color: '#FF4800' }}>+64%</div>
            <div style={{ fontSize: 18, color: '#888480', marginTop: 8 }}>Accuracy</div>
          </div>
        </div>
        <div style={{ display: 'flex', fontSize: 16, color: '#555', marginTop: 48 }}>mdspin.app</div>
      </div>
    ),
    { ...size },
  )
}
