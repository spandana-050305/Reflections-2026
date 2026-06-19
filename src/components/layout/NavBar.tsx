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
    <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b border-slate-200">
      <div className="px-4 sm:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Image src="/logo.png" alt="Rotaract Club MCE" width={36} height={36} className="object-contain" />
          <div className="leading-tight">
            <h1 className="font-bold text-slate-900">Reflections</h1>
            <p className="text-slate-500 text-xs">{roleLabel[role] ?? role}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-slate-500 text-sm font-medium hidden sm:block">{title}</span>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-slate-600 hover:text-red-600 hover:bg-red-50 px-3 py-2 rounded-xl text-sm font-medium transition-colors"
          >
            <LogOut size={15} />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </div>
    </header>
  )
}
