'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Mail, Lock, ArrowRight, Eye, EyeOff, School } from 'lucide-react'
import Image from 'next/image'
import PhotoGallery from '@/components/PhotoGallery'
import { getRole } from '@/lib/auth-role'

const stats = [
  { value: '10+', label: 'Years of Legacy' },
  { value: '60+', label: 'Competitions' },
  { value: '60+', label: 'Participating Schools' },
  { value: '1000+', label: 'Student Participants' },
  { value: '2', label: 'Days of Celebration' },
]

const whyParticipate = [
  { emoji: '🎭', text: 'Showcase your talents on a bigger stage.' },
  { emoji: '🏆', text: 'Compete with students from multiple schools.' },
  { emoji: '🎨', text: 'Explore cultural, literary, and creative competitions.' },
  { emoji: '🤝', text: 'Build friendships and unforgettable experiences.' },
  { emoji: '🌟', text: 'Win exciting prizes, certificates, and recognition.' },
]

const highlights = [
  'Multiple Cultural & Academic Competitions',
  'School Team Championships',
  'Stage Performances',
  'Creative Arts & Literary Events',
  'Certificates for Participants',
  'Exciting Prizes & Overall Championship Trophy',
]

export default function SchoolLoginPage() {
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const loginEmail = email.includes('@') ? email : `${email}@reflections.in`
      const { data, error } = await supabase.auth.signInWithPassword({ email: loginEmail, password })

      if (error || !data.user) {
        setError(error?.message ?? 'Invalid login ID or password. Please try again.')
        setLoading(false)
        return
      }

      const role = getRole(data.user)
      if (role !== 'school') {
        // Wrong portal — this account isn't a school login. Sign it back out
        // so no session is left behind, and point it to the organizer login.
        await supabase.auth.signOut()
        setError('This login is for schools only. Club members, admins, and judges should use the organizer sign-in.')
        setLoading(false)
        return
      }

      window.location.href = '/school/dashboard'
    } catch (err: any) {
      setError(`Network error: ${err?.message ?? String(err)}`)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col overflow-hidden">

      {/* ── Hero ── */}
      <div className="relative flex flex-col items-center justify-center pt-16 pb-12 px-4 text-center overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-32 -right-32 h-[500px] w-[500px] rounded-full bg-brand-300/30 blur-3xl" />
          <div className="absolute -bottom-32 -left-32 h-[500px] w-[500px] rounded-full bg-brand-200/40 blur-3xl" />
          <div className="absolute top-1/2 left-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-100/30 blur-3xl" />
        </div>
        <div className="pointer-events-none absolute inset-0 dot-grid opacity-30" />

        {/* Logo */}
        <div className="relative mb-6 animate-fade-in-up">
          <div className="absolute inset-0 rounded-3xl bg-brand-300/40 blur-xl animate-pulse-glow" />
          <div className="relative flex items-center justify-center h-24 w-24 rounded-3xl bg-white shadow-glow ring-1 ring-brand-100">
            <Image src="/logo.png" alt="Rotaract Club MCE" width={64} height={64} className="object-contain" />
          </div>
        </div>

        <h1 className="text-5xl sm:text-7xl tracking-tight text-gradient animate-fade-in-up" style={{ fontFamily: 'var(--font-lilita)', animationDelay: '0.1s' }}>
          Reflections
        </h1>
        <p className="text-base sm:text-lg font-medium text-slate-600 mt-3 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
          Rotaract Club of MCE, Hassan
        </p>
        <p className="text-sm sm:text-base text-slate-400 mt-1.5 animate-fade-in-up" style={{ animationDelay: '0.25s' }}>
          Celebrating Talent. Inspiring Excellence. Building Memories.
        </p>

        {/* Quick sign in — jumps down to the full sign-in form */}
        <button
          type="button"
          onClick={() => document.getElementById('school-sign-in')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
          className="btn-primary w-full max-w-sm mt-8 flex items-center justify-center gap-1.5 py-2.5 text-sm animate-fade-in-up"
          style={{ animationDelay: '0.28s' }}
        >
          Sign In <ArrowRight size={14} />
        </button>

        {/* Stats */}
        <div className="flex flex-wrap justify-center gap-6 sm:gap-10 mt-10 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
          {stats.map(s => (
            <div key={s.label} className="text-center">
              <p className="text-2xl sm:text-3xl font-bold text-brand-600">{s.value}</p>
              <p className="text-xs text-slate-400 mt-0.5 max-w-[80px]">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── About ── */}
      <div className="max-w-3xl mx-auto px-6 py-10 text-center">
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-800">Where Young Talent Takes Center Stage</h2>
        <p className="text-slate-500 mt-4 leading-relaxed text-sm sm:text-base">
          Reflections is the flagship annual inter-school event organized by the Rotaract Club of MCE, Hassan.
          For over a decade, it has brought together students from schools across the Hassan to compete, perform,
          create, and grow through a diverse range of cultural, literary, artistic, and academic events.
        </p>
        <p className="text-slate-500 mt-3 leading-relaxed text-sm sm:text-base">
          More than a competition, Reflections is a platform that nurtures confidence, creativity, teamwork, and
          lifelong memories while celebrating the incredible potential of young minds.
        </p>
      </div>

      {/* ── Why Participate + Event Highlights ── */}
      <div className="max-w-4xl mx-auto px-6 pb-10 grid sm:grid-cols-2 gap-6">
        {/* Why Participate */}
        <div className="card">
          <h3 className="text-lg font-bold text-slate-800 mb-4">Why Participate?</h3>
          <ul className="space-y-3">
            {whyParticipate.map((item, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-slate-600">
                <span className="text-lg leading-none mt-0.5">{item.emoji}</span>
                <span>{item.text}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Event Highlights */}
        <div className="card">
          <h3 className="text-lg font-bold text-slate-800 mb-4">Event Highlights</h3>
          <ul className="space-y-2.5">
            {highlights.map((h, i) => (
              <li key={i} className="flex items-center gap-2.5 text-sm text-slate-600">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-500 shrink-0" />
                {h}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* ── Gallery ── */}
      <div className="py-10 bg-gray-50/60">
        <div className="text-center mb-8 px-4">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-800">Moments That Define Reflections</h2>
          <p className="text-slate-400 text-sm mt-2 max-w-xl mx-auto">
            A glimpse into the energy, excitement, creativity, and unforgettable memories created every year.
          </p>
        </div>

        <PhotoGallery />
      </div>

      {/* ── School Sign In ── */}
      <div id="school-sign-in" className="relative w-full max-w-md mx-auto px-4 py-12 scroll-mt-6">
        <div className="rounded-2xl border border-brand-200 bg-white shadow-lg shadow-brand-200/50 overflow-hidden">
          <div className="h-1 w-full bg-gradient-to-r from-brand-500 via-brand-600 to-brand-700" />
          <div className="p-8">
            <h2 className="text-lg font-semibold text-slate-800 mb-1 flex items-center gap-2">
              <School size={18} className="text-brand-600" /> School Sign In
            </h2>
            <p className="text-sm text-slate-500 mb-6">Sign in with the login ID and password given to your school.</p>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Login ID</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input type="text" value={email} onChange={e => setEmail(e.target.value)} className="input pl-10" placeholder="your school's login ID" required />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} className="input pl-10 pr-10" placeholder="••••••••" required />
                  <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors" tabIndex={-1}>
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              {error && <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl border border-red-100">{error}</div>}
              <button type="submit" className="btn-primary w-full mt-2 py-3" disabled={loading}>
                {loading ? 'Signing in…' : <span className="flex items-center justify-center gap-2">Sign In <ArrowRight size={16} /></span>}
              </button>
            </form>
          </div>
        </div>
      </div>

    </div>
  )
}
