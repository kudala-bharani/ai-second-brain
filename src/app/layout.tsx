import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'
import './globals.css'

const geist = localFont({
  src: './fonts/geist.woff2',
  weight: '400 700',
  display: 'swap',
  variable: '--font-geist',
})

export const metadata: Metadata = {
  title: {
    default: 'AI Second Brain',
    template: '%s | AI Second Brain',
  },
  description:
    'Your personal AI-powered knowledge base. Store notes, ask questions, and get answers grounded in your own data.',
  keywords: ['AI', 'notes', 'knowledge base', 'RAG', 'second brain', 'OpenAI'],
  authors: [{ name: 'AI Second Brain' }],
  robots: { index: false, follow: false }, // private app — don't index
}

export const viewport: Viewport = {
  themeColor: '#101314',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={geist.variable}>
      <body>
        {children}
      </body>
    </html>
  )
}
