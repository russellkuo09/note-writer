'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import type { SchoolResult } from '@/app/api/school-search/route'

interface Props {
  value: string
  onChange: (val: string) => void
  onSelect: (name: string) => void
  placeholder?: string
  className?: string
  savedSchool?: string | null
}

export default function SchoolSearchInput({
  value,
  onChange,
  onSelect,
  placeholder = 'Search for your high school…',
  className = '',
  savedSchool,
}: Props) {
  const [results, setResults] = useState<SchoolResult[]>([])
  const [popularSchools, setPopularSchools] = useState<SchoolResult[]>([])
  const [searching, setSearching] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [dropdownRect, setDropdownRect] = useState<{ top: number; left: number; width: number } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Pre-load popular schools on mount
  useEffect(() => {
    fetch('/api/school-search?popular=1')
      .then(r => r.json())
      .then((data: SchoolResult[]) => setPopularSchools(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [])

  const search = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (q.trim().length < 2) { setResults([]); setSearching(false); setShowDropdown(false); return }
    setSearching(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/school-search?q=${encodeURIComponent(q)}`)
        const data: SchoolResult[] = await res.json()
        setResults(data)
        if (data.length > 0 && inputRef.current === document.activeElement) {
          const rect = inputRef.current!.getBoundingClientRect()
          setDropdownRect({ top: rect.bottom + window.scrollY + 4, left: rect.left + window.scrollX, width: rect.width })
          setShowDropdown(true)
        }
      } catch { setResults([]) }
      finally { setSearching(false) }
    }, 350)
  }, [])

  // Recompute position on scroll/resize
  useEffect(() => {
    if (!showDropdown) return
    const update = () => {
      if (inputRef.current) {
        const rect = inputRef.current.getBoundingClientRect()
        setDropdownRect({ top: rect.bottom + window.scrollY + 4, left: rect.left + window.scrollX, width: rect.width })
      }
    }
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => { window.removeEventListener('scroll', update, true); window.removeEventListener('resize', update) }
  }, [showDropdown])

  function handleSelect(name: string) {
    onSelect(name)
    onChange(name)
    setShowDropdown(false)
    setResults([])
  }

  // Show popular schools when focused and no query typed yet
  const displayResults = value.trim().length < 2 ? popularSchools : results

  const dropdown = showDropdown && displayResults.length > 0 && dropdownRect
    ? createPortal(
        <div
          style={{
            position: 'absolute',
            top: dropdownRect.top,
            left: dropdownRect.left,
            width: dropdownRect.width,
            zIndex: 9999,
          }}
          className="bg-white border border-cream-dark rounded-2xl shadow-xl overflow-hidden"
        >
          {value.trim().length < 2 && popularSchools.length > 0 && (
            <p className="px-4 pt-2 pb-1 font-body text-xs text-charcoal/40 uppercase tracking-wide">Popular schools</p>
          )}
          {displayResults.map((r) => (
            <button
              key={r.id}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); handleSelect(r.name) }}
              className="w-full text-left px-4 py-3 hover:bg-cream/60 transition-colors border-b border-cream-dark last:border-0"
            >
              <p className="font-body text-sm font-semibold text-charcoal leading-tight">{r.name}</p>
              <p className="font-body text-xs text-charcoal/40 mt-0.5 leading-tight">{r.address}</p>
            </button>
          ))}
        </div>,
        document.body
      )
    : null

  return (
    <div className="relative">
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => { onChange(e.target.value.slice(0, 100)); search(e.target.value) }}
          onFocus={() => {
            if (inputRef.current) {
              const rect = inputRef.current.getBoundingClientRect()
              setDropdownRect({ top: rect.bottom + window.scrollY + 4, left: rect.left + window.scrollX, width: rect.width })
              // Show popular schools even before typing
              if (displayResults.length > 0) setShowDropdown(true)
            }
          }}
          onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
          placeholder={placeholder}
          className={`w-full ${className}`}
          autoComplete="off"
        />
        {searching && (
          <span className="absolute right-3 text-xs text-charcoal/30 animate-pulse pointer-events-none">searching…</span>
        )}
      </div>

      {/* Saved school hint */}
      {savedSchool && value !== savedSchool && (
        <p className="text-xs font-body text-charcoal/40 mt-1 ml-1">
          Saved: <span className="font-semibold text-charcoal/60">{savedSchool}</span>
        </p>
      )}

      {dropdown}
    </div>
  )
}
