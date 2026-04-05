'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import Logo from './Logo'

interface AuthModalProps {
  onClose?: () => void
  onSuccess?: () => void
}

export default function AuthModal({ onClose, onSuccess }: AuthModalProps) {
  const [mode, setMode] = useState<'signup' | 'login'>('signup')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [location, setLocation] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [showReset, setShowReset] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)

  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      if (mode === 'signup') {
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { name },
          },
        })
        if (signUpError) throw signUpError

        // Create profile — use user from signUp response directly.
        // Do NOT call getUser() here: with email confirmation enabled the
        // session isn't active yet, so getUser() returns null and the
        // profile insert silently fails.
        const newUser = signUpData?.user
        if (newUser) {
          // Generate a random 8-char referral code
          const referralCode = Array.from(crypto.getRandomValues(new Uint8Array(4)))
            .map(b => b.toString(16).padStart(2, '0')).join('')
          const { error: profileError } = await supabase.from('profiles').upsert({
            id: newUser.id,
            name,
            email,
            role: 'supporter',
            referral_code: referralCode,
            ...(location.trim() ? { location: location.trim() } : {}),
          })
          if (profileError) {
            console.error('[AuthModal] profile upsert failed:', profileError)
          } else {
            console.log('[AuthModal] profile created for', newUser.id)
          }
        } else {
          console.warn('[AuthModal] signUp returned no user — profile not created')
        }

        setSent(true)
        onSuccess?.()
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (signInError) throw signInError
        onSuccess?.()
        onClose?.()
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong. Please try again.'
      setError(msg)
      // Show reset option on any login credential failure
      if (mode === 'login' && (
        msg.toLowerCase().includes('invalid') ||
        msg.toLowerCase().includes('incorrect') ||
        msg.toLowerCase().includes('credentials') ||
        msg.toLowerCase().includes('password')
      )) {
        setShowReset(true)
      }
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="fixed inset-0 bg-charcoal/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 w-full max-w-sm text-center animate-fade-in-up">
          <div className="text-5xl mb-4">🌷</div>
          <h2 className="font-display text-2xl font-semibold text-charcoal mb-3">
            Check your email
          </h2>
          <p className="font-body text-charcoal/70 mb-6">
            We sent a confirmation to <strong>{email}</strong>. Click the link to activate your account, then come back here.
          </p>
          <button
            onClick={onClose}
            className="w-full py-3 rounded-2xl bg-blush text-primary font-body font-semibold text-base"
          >
            Got it
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      className="fixed inset-0 bg-charcoal/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <div className="bg-white rounded-3xl p-8 w-full max-w-sm animate-fade-in-up">
        <div className="flex justify-center mb-6">
          <Logo size="sm" />
        </div>

        <h2 className="font-display text-2xl font-semibold text-charcoal text-center mb-1">
          {mode === 'signup' ? 'Join the movement' : 'Welcome back'}
        </h2>
        <p className="font-body text-sm text-charcoal/60 text-center mb-6">
          {mode === 'signup'
            ? 'Sign up to write notes and earn volunteer hours'
            : 'Log in to keep writing'}
        </p>

        {error && (
          <div className="mb-4 rounded-xl bg-red-50 text-red-600 text-sm font-body overflow-hidden">
            <p className="p-3">{error}</p>
            {showReset && !resetSent && (
              <div className="border-t border-red-100 px-3 py-2.5 flex items-center justify-between bg-red-50/60">
                <span className="text-xs text-red-400">Forgot your password?</span>
                <button
                  type="button"
                  disabled={resetLoading || !email}
                  onClick={async () => {
                    setResetLoading(true)
                    await supabase.auth.resetPasswordForEmail(email, {
                      redirectTo: `${window.location.origin}/`,
                    })
                    setResetLoading(false)
                    setResetSent(true)
                  }}
                  className="text-xs font-semibold text-primary underline disabled:opacity-50"
                >
                  {resetLoading ? 'Sending…' : `Send reset email${email ? ` to ${email}` : ''}`}
                </button>
              </div>
            )}
            {showReset && resetSent && (
              <div className="border-t border-red-100 px-3 py-2.5 bg-red-50/60">
                <p className="text-xs text-sage font-semibold">✓ Reset email sent — check your inbox</p>
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === 'signup' && (
            <>
              <div>
                <label className="block text-xs font-body font-semibold text-charcoal/60 mb-1 uppercase tracking-wide">
                  Your name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="First name"
                  required
                  className="w-full px-4 py-3 rounded-2xl bg-cream border border-cream-dark font-body text-base text-charcoal placeholder:text-charcoal/30 focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="block text-xs font-body font-semibold text-charcoal/60 mb-1 uppercase tracking-wide">
                  Where are you writing from? <span className="normal-case font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value.slice(0, 100))}
                  placeholder="e.g. Los Angeles, CA"
                  className="w-full px-4 py-3 rounded-2xl bg-cream border border-cream-dark font-body text-base text-charcoal placeholder:text-charcoal/30 focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <p className="text-xs font-body text-charcoal/40 mt-1 ml-1">Helps us show our reach 🌷</p>
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-body font-semibold text-charcoal/60 mb-1 uppercase tracking-wide">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="w-full px-4 py-3 rounded-2xl bg-cream border border-cream-dark font-body text-base text-charcoal placeholder:text-charcoal/30 focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div>
            <label className="block text-xs font-body font-semibold text-charcoal/60 mb-1 uppercase tracking-wide">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setShowReset(false); setResetSent(false) }}
              placeholder="Choose a password"
              required
              minLength={6}
              className="w-full px-4 py-3 rounded-2xl bg-cream border border-cream-dark font-body text-base text-charcoal placeholder:text-charcoal/30 focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 rounded-2xl bg-primary text-white font-body font-bold text-base mt-2 transition-all active:scale-95 disabled:opacity-60"
            style={{ boxShadow: '0 4px 20px rgba(232, 99, 122, 0.35)' }}
          >
            {loading
              ? '...'
              : mode === 'signup'
              ? 'Start writing notes 🌷'
              : 'Log in'}
          </button>
        </form>

        <p className="text-center font-body text-sm text-charcoal/50 mt-4">
          {mode === 'signup' ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button
            onClick={() => { setMode(mode === 'signup' ? 'login' : 'signup'); setError(''); setShowReset(false); setResetSent(false) }}
            className="text-primary font-semibold"
          >
            {mode === 'signup' ? 'Log in' : 'Sign up'}
          </button>
        </p>
      </div>
    </div>
  )
}
