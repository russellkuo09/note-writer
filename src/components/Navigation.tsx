'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface NavigationProps {
  isAdmin?: boolean
}

export default function Navigation({ isAdmin = false }: NavigationProps) {
  const pathname = usePathname()

  const tabs = [
    { href: '/', label: 'Write', icon: '✏️' },
    { href: '/impact', label: 'My Impact', icon: '🌷' },
    ...(isAdmin ? [{ href: '/admin', label: 'Queue', icon: '📋' }] : []),
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-cream-dark z-50 bottom-nav">
      <div className="flex items-center justify-around max-w-lg mx-auto px-4 pt-2">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-col items-center gap-0.5 py-1 px-4 rounded-xl transition-all ${
                isActive
                  ? 'text-primary'
                  : 'text-charcoal/40 hover:text-charcoal/70'
              }`}
            >
              <span className="text-xl">{tab.icon}</span>
              <span
                className={`text-xs font-body font-semibold ${
                  isActive ? 'text-primary' : 'text-charcoal/40'
                }`}
              >
                {tab.label}
              </span>
              {isActive && (
                <span className="w-1 h-1 rounded-full bg-primary" />
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
