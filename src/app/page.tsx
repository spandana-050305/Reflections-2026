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

export default function LandingPage() {
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

        <h1 className="text-5xl sm:text-7xl font-bold tracking-tight text-gradient animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          Reflections '26
        </h1>
        <p className="text-base sm:text-lg font-medium text-slate-600 mt-3 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
          Rotaract Club of MCE, Hassan
        </p>
        <p className="text-sm sm:text-base text-slate-400 mt-1.5 animate-fade-in-up" style={{ animationDelay: '0.25s' }}>
          Celebrating Talent. Inspiring Excellence. Building Memories.
        </p>

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
          Reflections is the flagship annual inter-school festival organized by the Rotaract Club of MCE, Hassan.
          For over a decade, it has brought together students from schools across the region to compete, perform,
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
        <div className="text-center mb-6 px-4">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-800">Moments That Define Reflections</h2>
          <p className="text-slate-400 text-sm mt-2 max-w-xl mx-auto">
            A glimpse into the energy, excitement, creativity, and unforgettable memories created every year.
          </p>
        </div>

        <div className="relative w-full overflow-hidden">
          <div className="pointer-events-none absolute left-0 top-0 h-full w-16 sm:w-24 z-10 bg-gradient-to-r from-gray-50/60 to-transparent" />
          <div className="pointer-events-none absolute right-0 top-0 h-full w-16 sm:w-24 z-10 bg-gradient-to-l from-gray-50/60 to-transparent" />

          <div className="flex gap-4 px-4 overflow-x-auto snap-x snap-mandatory pb-3" style={{ scrollbarWidth: 'none' }}>
            {photos.map((p, i) => (
              <div
                key={i}
                className="snap-center shrink-0 w-72 sm:w-80 h-52 sm:h-60 rounded-2xl overflow-hidden shadow-md ring-1 ring-gray-200 relative"
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
      </div>

      {/* ── CTA ── */}
      <div className="flex flex-col items-center py-16 px-4 gap-4">
        <h2 className="text-xl font-semibold text-slate-700">Ready to be part of it?</h2>
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
