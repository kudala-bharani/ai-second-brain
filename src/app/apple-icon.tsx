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
          background: '#d7e4aa',
          borderRadius: '32px',
        }}
      >
        <svg width="108" height="108" viewBox="0 0 24 24" fill="none" stroke="#252c1b" strokeWidth="1.5" strokeLinecap="round">
          <path d="M7 4v16M11 7h7m-7 5h7m-7 5h7" />
        </svg>
      </div>
    ),
    {
      ...size,
    }
  )
}
