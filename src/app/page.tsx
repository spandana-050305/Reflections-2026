'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Mail, Lock, ArrowRight, FlaskConical, Eye, EyeOff } from 'lucide-react'
import Image from 'next/image'

export default function LoginPage() {
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const isLocalMode = process.env.NEXT_PUBLIC_LOCAL_MODE === 'true'

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })

      if (error || !data.user) {
        setError(error?.message ?? 'Invalid email or password. Please try again.')
        setLoading(false)
        return
      }

      const role = data.user?.user_metadata?.role
      if (role === 'school')           window.location.href = '/school/dashboard'
      else if (role === 'club_member') window.location.href = '/club/dashboard'
      else if (role === 'final_year')  window.location.href = '/admin/dashboard'
      else if (role === 'guest')       window.location.href = '/guest/evaluate'
      else {
        setError(`Role "${role ?? 'undefined'}" not recognised — contact the admin.`)
        setLoading(false)
      }
    } catch (err: any) {
      setError(`Network error: ${err?.message ?? String(err)}`)
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden bg-white">
      {/* Subtle pink gradient blobs */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-pink-200/40 blur-3xl" />
        <div className="absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-pink-100/60 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-rose-100/30 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md animate-fade-in-up">
        {/* Logo + title */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <Image
              src="/logo.png"
              alt="Rotaract Club MCE"
              width={80}
              height={80}
              className="object-contain drop-shadow-sm"
            />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Reflections</h1>
          <p className="text-slate-500 mt-1.5 text-sm">Rotaract Club MCE · Event Platform</p>
        </div>

        {/* Login Card */}
        <div className="rounded-2xl border border-pink-100 bg-white shadow-lg shadow-pink-100/50 overflow-hidden">
          {/* Pink accent stripe at top */}
          <div className="h-1 w-full bg-gradient-to-r from-pink-400 via-rose-400 to-pink-500" />

          <div className="p-8">
            <h2 className="text-lg font-semibold text-slate-800 mb-6">Sign in to your account</h2>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="input pl-10"
                    placeholder="your@email.com"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="input pl-10 pr-10"
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl border border-red-100">
                  {error}
                </div>
              )}

              <button type="submit" className="btn-primary w-full mt-2 py-3" disabled={loading}>
                {loading
                  ? 'Signing in…'
                  : <span className="flex items-center justify-center gap-2">Sign In <ArrowRight size={16} /></span>
                }
              </button>
            </form>
          </div>
        </div>

        {/* Local mode hint */}
        {isLocalMode && (
          <p className="text-center text-xs text-slate-400 mt-4">
            Local mode active — use credentials from the Schools page
          </p>
        )}
      </div>
    </div>
  )
}
