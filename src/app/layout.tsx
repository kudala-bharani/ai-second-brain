import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
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
  themeColor: '#0f0f18',
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
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className="min-h-screen bg-surface-900 text-slate-100 antialiased font-sans selection:bg-brand-500/30 selection:text-brand-200">
        {children}
      </body>
    </html>
  )
}
