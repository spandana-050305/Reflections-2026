import type { Metadata } from 'next'
import { Lilita_One } from 'next/font/google'
import './globals.css'

const lilitaOne = Lilita_One({ subsets: ['latin'], weight: '400', variable: '--font-lilita' })

export const metadata: Metadata = {
  title: 'Reflections',
  description: 'Rotaract Club — Reflections Event Management Platform',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={lilitaOne.variable}>
      <body className="font-sans">{children}</body>
    </html>
  )
}
