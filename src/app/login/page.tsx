'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Mail, Lock, ArrowRight, Eye, EyeOff, User, UserPlus } from 'lucide-react'
import Image from 'next/image'

function slugifyLoginId(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9._-]/g, '').trim()
}

export default function LoginPage() {
  const supabase = createClient()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Register fields
  const [regName, setRegName] = useState('')
  const [regLoginId, setRegLoginId] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [regRole, setRegRole] = useState<'club_member' | 'final_year'>('club_member')
  const [regDone, setRegDone] = useState(false)

  const isLocalMode = process.env.NEXT_PUBLIC_LOCAL_MODE === 'true'

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const slug = slugifyLoginId(regLoginId)
    if (!regName.trim()) { setError('Please enter your name.'); return }
    if (!slug) { setError('Please enter a valid login ID (letters, numbers, . _ -).'); return }
    if (regPassword.length < 4) { setError('Password must be at least 4 characters.'); return }
    setLoading(true)
    const regEmail = `${slug}@reflections.in`

    try {
      const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
        email: regEmail,
        password: regPassword,
        options: { data: { role: regRole } },
      })
      if (signUpErr) {
        setError(signUpErr.message.includes('already') ? `Login ID "${slug}" is already taken.` : signUpErr.message)
        setLoading(false)
        return
      }
      const { error: dbErr } = await supabase.from('club_accounts').insert({
        name: regName.trim(),
        login_id: slug,
        email: regEmail,
        role: regRole,
        status: 'pending',
        user_id: signUpData?.user?.id ?? null,
        created_at: new Date().toISOString(),
      })
      if (dbErr) {
        // Sign out the orphaned auth user we just created so they can't accidentally log in
        await supabase.auth.signOut()
        setError(`Registration failed: ${dbErr.message}. Please try again or contact the admin.`)
        setLoading(false)
        return
      }
      setRegDone(true)
      setLoading(false)
    } catch (err: any) {
      setError(`Network error: ${err?.message ?? String(err)}`)
      setLoading(false)
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const loginEmail = email.includes('@') ? email : `${email}@reflections.in`
      const { data, error } = await supabase.auth.signInWithPassword({ email: loginEmail, password })

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
      else if (role === 'super_admin') window.location.href = '/admin/dashboard'
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
      {/* Animated pink gradient blobs */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-brand-300/40 blur-3xl animate-float-slow" />
        <div className="absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-brand-200/60 blur-3xl animate-float" />
        <div className="absolute top-1/2 left-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-100/40 blur-3xl animate-pulse-glow" />
      </div>
      {/* Subtle dot texture */}
      <div className="pointer-events-none absolute inset-0 dot-grid opacity-40" />

      <div className="relative w-full max-w-md animate-fade-in-up">
        {/* Logo + title */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <div className="relative">
              <div className="absolute inset-0 rounded-3xl bg-brand-300/40 blur-xl animate-pulse-glow" />
              <div className="relative flex items-center justify-center h-20 w-20 rounded-3xl bg-white shadow-glow ring-1 ring-brand-100">
                <Image
                  src="/logo.png"
                  alt="Rotaract Club MCE"
                  width={56}
                  height={56}
                  className="object-contain"
                />
              </div>
            </div>
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-gradient">Reflections</h1>
          <p className="text-slate-500 mt-1.5 text-sm">Rotaract Club MCE · Event Platform</p>
        </div>

        {/* Login Card */}
        <div className="rounded-2xl border border-brand-200 bg-white shadow-lg shadow-brand-200/50 overflow-hidden">
          {/* Rotaract accent stripe at top */}
          <div className="h-1 w-full bg-gradient-to-r from-brand-500 via-brand-600 to-brand-700" />

          <div className="p-8">
            {mode === 'login' ? (
              <>
                <h2 className="text-lg font-semibold text-slate-800 mb-6">Sign in to your account</h2>
                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Email / Login ID</label>
                    <div className="relative">
                      <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input type="text" value={email} onChange={e => setEmail(e.target.value)} className="input pl-10" placeholder="your@email.com or login ID" required />
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
                <p className="text-center text-sm text-slate-500 mt-5">
                  Are you a club member?{' '}
                  <button onClick={() => { setMode('register'); setError(''); setRegDone(false) }} className="font-semibold text-brand-600 hover:underline">Register here</button>
                </p>
              </>
            ) : regDone ? (
              <div className="text-center py-4 space-y-3">
                <div className="mx-auto h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                  <UserPlus size={22} className="text-green-600" />
                </div>
                <h2 className="text-lg font-semibold text-slate-800">Request submitted!</h2>
                <p className="text-sm text-slate-500">
                  Your club member account is awaiting approval from the Final Year admin. You'll be able to sign in once it's approved.
                </p>
                <button onClick={() => { setMode('login'); setRegDone(false); setRegName(''); setRegLoginId(''); setRegPassword('') }} className="btn-secondary w-full">Back to Sign In</button>
              </div>
            ) : (
              <>
                <h2 className="text-lg font-semibold text-slate-800 mb-1">Register as a club member</h2>
                <p className="text-sm text-slate-500 mb-6">Your request will be reviewed by the Final Year admin before you can sign in.</p>
                <form onSubmit={handleRegister} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Access level</label>
                    <div className="grid grid-cols-2 gap-2">
                      {([
                        { key: 'club_member', label: 'Club Member' },
                        { key: 'final_year', label: 'Final Year' },
                      ] as const).map(opt => (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => setRegRole(opt.key)}
                          className={`px-3 py-2.5 rounded-xl text-sm font-medium border transition-all ${regRole === opt.key ? 'bg-brand-600 text-white border-brand-600 shadow-glow' : 'bg-white text-slate-600 border-slate-200 hover:border-brand-300'}`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      {regRole === 'final_year' ? 'Full admin access — granted only after the admin approves.' : 'Club member portal access.'}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Full name</label>
                    <div className="relative">
                      <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input value={regName} onChange={e => setRegName(e.target.value)} className="input pl-10" placeholder="e.g. Priya Menon" required />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Login ID</label>
                    <div className="relative">
                      <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input value={regLoginId} onChange={e => setRegLoginId(e.target.value)} className="input pl-10" placeholder="e.g. priya_m" required />
                    </div>
                    {regLoginId.trim() && <p className="text-xs text-slate-400 mt-1">You'll sign in as <span className="font-mono">{slugifyLoginId(regLoginId)}@reflections.in</span></p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
                    <div className="relative">
                      <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input type={showPassword ? 'text' : 'password'} value={regPassword} onChange={e => setRegPassword(e.target.value)} className="input pl-10 pr-10" placeholder="Choose a password" required />
                      <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors" tabIndex={-1}>
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                  {error && <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl border border-red-100">{error}</div>}
                  <button type="submit" className="btn-primary w-full mt-2 py-3" disabled={loading}>
                    {loading ? 'Submitting…' : <span className="flex items-center justify-center gap-2">Submit Request <ArrowRight size={16} /></span>}
                  </button>
                </form>
                <p className="text-center text-sm text-slate-500 mt-5">
                  Already have an account?{' '}
                  <button onClick={() => { setMode('login'); setError('') }} className="font-semibold text-brand-600 hover:underline">Sign in</button>
                </p>
              </>
            )}
          </div>
        </div>

        {/* Local mode hint */}
        {isLocalMode && mode === 'login' && (
          <p className="text-center text-xs text-slate-400 mt-4">
            Local mode active — use credentials from the Schools page
          </p>
        )}
      </div>
    </div>
  )
}
