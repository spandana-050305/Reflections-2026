'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface NavLinkProps {
  href: string
  label: string
  variant?: 'sidebar' | 'mobile'
  children: React.ReactNode // icon
}

export default function NavLink({ href, label, variant = 'sidebar', children }: NavLinkProps) {
  const pathname = usePathname()
  const active = pathname === href || pathname.startsWith(href + '/')

  if (variant === 'mobile') {
    return (
      <Link
        href={href}
        className={`flex-shrink-0 flex flex-col items-center py-2 px-3 text-xs gap-1 transition-colors ${
          active ? 'text-brand-600 font-semibold' : 'text-slate-500 hover:text-brand-600'
        }`}
      >
        {children}
        <span className="whitespace-nowrap">{label}</span>
      </Link>
    )
  }

  return (
    <Link href={href} className={`nav-link ${active ? 'nav-link-active' : ''}`}>
      {children}
      {label}
    </Link>
  )
}
