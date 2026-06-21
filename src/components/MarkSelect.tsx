'use client'

import { ChevronDown } from 'lucide-react'

// A compact, CSS-stylable dropdown for picking a mark (0..max).
// Native <select> so the popup is never clipped by scrollable tables and
// the mobile picker feels native — styled to match our .input class.
export default function MarkSelect({
  value,
  onChange,
  disabled = false,
  max = 10,
}: {
  value: number
  onChange: (n: number) => void
  disabled?: boolean
  max?: number
}) {
  return (
    <div className="relative w-16 mx-auto">
      <select
        value={value}
        disabled={disabled}
        onChange={e => onChange(Number(e.target.value))}
        className="input appearance-none w-full text-center pl-2 pr-5 py-1 cursor-pointer
                   disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed"
      >
        {Array.from({ length: max + 1 }, (_, n) => (
          <option key={n} value={n}>{n}</option>
        ))}
      </select>
      <ChevronDown
        size={12}
        className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
      />
    </div>
  )
}
