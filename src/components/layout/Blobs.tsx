// Decorative floating gradient blobs — purely visual, no interaction.
// Drop inside a `relative overflow-hidden` parent.
export default function Blobs({ className = '' }: { className?: string }) {
  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden>
      <div className="blob -top-24 -right-20 h-72 w-72 bg-brand-300/30 animate-float-slow" />
      <div className="blob top-1/3 -left-24 h-64 w-64 bg-brand-200/40 animate-float" />
      <div className="blob -bottom-24 right-1/4 h-72 w-72 bg-brand-100/50 animate-pulse-glow" />
    </div>
  )
}
