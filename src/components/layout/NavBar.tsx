'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { LogOut } from 'lucide-react'
import Image from 'next/image'

interface NavBarProps {
  title: string
  role: string
  slotNumber?: number
}

export default function NavBar({ title, role, slotNumber }: NavBarProps) {
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  const roleLabel: Record<string, string> = {
    school: `School · Slot ${slotNumber}`,
    club_member: 'Club Member',
    final_year: 'Final Year',
    guest: 'Guest Evaluator',
  }

  return (
    <header className="sticky top-0 z-30 bg-white/70 backdrop-blur-xl border-b border-brand-200/40 shadow-[0_1px_0_0_rgb(255_10_108_/_0.12)]">
      {/* Thin brand accent line */}
      <div className="h-0.5 w-full bg-gradient-to-r from-brand-400 via-brand-500 to-brand-600" />
      <div className="px-4 sm:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative shrink-0">
            <div className="absolute inset-0 rounded-xl bg-brand-300/40 blur-md" />
            <div className="relative flex items-center justify-center h-10 w-10 rounded-xl bg-white shadow-sm ring-1 ring-brand-100">
              <Image src="/logo.png" alt="Rotaract Club MCE" width={32} height={32} className="object-contain" />
            </div>
          </div>
          <div className="leading-tight">
            <h1 className="font-bold text-gradient text-lg">Reflections</h1>
            <p className="text-brand-800 text-xs font-medium">{roleLabel[role] ?? role}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-brand-800 text-sm font-medium hidden sm:block px-3 py-1 rounded-full bg-brand-50 border border-brand-200">{title}</span>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-brand-800 hover:text-red-600 hover:bg-red-50 px-3 py-2 rounded-xl text-sm font-medium transition-colors"
          >
            <LogOut size={15} />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </div>
    </header>
  )
}
