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
        className={`flex-shrink-0 flex flex-col items-center py-1.5 px-3 text-[11px] gap-1 rounded-2xl transition-all duration-200 ${
          active
            ? 'text-brand-700 font-semibold bg-gradient-to-b from-brand-50 to-brand-100/70 shadow-[inset_0_0_0_1px_rgb(251_207_232)] -translate-y-0.5'
            : 'text-slate-500 hover:text-brand-600 active:scale-95'
        }`}
      >
        <span className={active ? 'scale-110 transition-transform' : 'transition-transform'}>{children}</span>
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
