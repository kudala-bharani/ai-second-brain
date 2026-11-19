import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export const size = {
  width: 180,
  height: 180,
}

export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#203f38',
          borderRadius: '32px',
        }}
      >
        <svg width="108" height="108" viewBox="0 0 24 24" fill="none" stroke="#93dcc7" strokeWidth="1.5" strokeLinecap="round">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M7.5 9h9M7.5 14h6" />
        </svg>
      </div>
    ),
    {
      ...size,
    }
  )
}
