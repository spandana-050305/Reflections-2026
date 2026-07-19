import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

const photos = [
  { src: '/photos/photo1.jpg', alt: 'Reflections team' },
  { src: '/photos/photo2.jpg', alt: 'Reflections stage' },
  { src: '/photos/photo3.jpg', alt: 'Reflections performance' },
  { src: '/photos/photo4.jpg', alt: 'Reflections 23 stage' },
  { src: '/photos/photo5.jpg', alt: 'Reflections highlights' },
  { src: '/photos/photo6.jpg', alt: 'Reflections moments' },
  { src: '/photos/photo7.jpeg', alt: 'Reflections event' },
  { src: '/photos/photo8.jpeg', alt: 'Reflections participants' },
  { src: '/photos/photo9.jpeg', alt: 'Reflections celebration' },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white flex flex-col overflow-hidden">

      {/* ── Hero ── */}
      <div className="relative flex flex-col items-center justify-center pt-16 pb-10 px-4 text-center overflow-hidden">
        {/* Gradient blobs */}
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

        <h1 className="text-5xl sm:text-7xl font-bold tracking-tight text-gradient animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          Reflections
        </h1>
        <p className="text-lg sm:text-xl text-slate-500 mt-3 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
          Rotaract Club MCE
        </p>
        <p className="text-sm text-slate-400 mt-1 animate-fade-in-up" style={{ animationDelay: '0.25s' }}>
          An Inter-School Cultural & Academic Competition
        </p>

        {/* Stats */}
        <div className="flex gap-8 mt-8 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
          {[
            { label: 'Years Running', value: '4+' },
            { label: 'Events', value: '20+' },
            { label: 'Schools', value: '25+' },
          ].map(s => (
            <div key={s.label} className="text-center">
              <p className="text-2xl font-bold text-brand-600">{s.value}</p>
              <p className="text-xs text-slate-400 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Photo Strip ── */}
      <div className="relative w-full overflow-hidden py-4">
        {/* Fade edges */}
        <div className="pointer-events-none absolute left-0 top-0 h-full w-24 z-10 bg-gradient-to-r from-white to-transparent" />
        <div className="pointer-events-none absolute right-0 top-0 h-full w-24 z-10 bg-gradient-to-l from-white to-transparent" />

        <div className="flex gap-4 px-4 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-2">
          {photos.map((p, i) => (
            <div
              key={i}
              className="snap-center shrink-0 w-72 sm:w-80 h-52 sm:h-60 rounded-2xl overflow-hidden shadow-md ring-1 ring-gray-100 relative"
            >
              <Image
                src={p.src}
                alt={p.alt}
                fill
                className="object-cover hover:scale-105 transition-transform duration-500"
                sizes="320px"
              />
            </div>
          ))}
        </div>
      </div>

      {/* ── About ── */}
      <div className="max-w-2xl mx-auto px-6 py-10 text-center">
        <h2 className="text-2xl font-bold text-slate-800">Where Young Talent Shines</h2>
        <p className="text-slate-500 mt-3 leading-relaxed text-sm sm:text-base">
          Reflections is Rotaract Club MCE's annual inter-school competition — bringing together
          students from across the region to compete, create, and celebrate their talents across
          arts, academics, and cultural events.
        </p>
      </div>

      {/* ── CTA ── */}
      <div className="flex-1 flex flex-col items-center justify-end pb-16 px-4 gap-4">
        <Link
          href="/login"
          className="btn-primary flex items-center gap-2 px-10 py-3.5 text-base rounded-2xl shadow-glow"
        >
          Sign In to Portal <ArrowRight size={18} />
        </Link>
        <p className="text-xs text-slate-400">Schools · Club Members · Admins · Judges</p>
      </div>
    </div>
  )
}
