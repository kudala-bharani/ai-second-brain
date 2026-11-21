import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export const size = {
  width: 32,
  height: 32,
}

export const contentType = 'image/png'

export default function Icon() {
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
          borderRadius: '5px',
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#252c1b" strokeWidth="1.5" strokeLinecap="round">
          <path d="M7 4v16M11 7h7m-7 5h7m-7 5h7" />
        </svg>
      </div>
    ),
    {
      ...size,
    }
  )
}
