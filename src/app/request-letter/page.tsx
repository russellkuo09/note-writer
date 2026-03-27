'use client'

import { useRouter } from 'next/navigation'
import Logo from '@/components/Logo'

const steps = [
  {
    number: '1',
    title: 'Go to My Impact',
    description: 'Head to the My Impact tab at the bottom of the screen.',
    icon: '🌸',
  },
  {
    number: '2',
    title: 'Tap "Share Impact"',
    description: 'Hit the Share Impact button to generate your personalized impact card showing your notes and volunteer minutes.',
    icon: '📸',
  },
  {
    number: '3',
    title: 'Download the image',
    description: 'Save the impact card image to your phone or computer.',
    icon: '⬇️',
  },
  {
    number: '4',
    title: 'Email it to us',
    description: 'Send the downloaded image to joinflowersforfighters@gmail.com with your name and the subject line "Volunteer Hours Letter Request."',
    icon: '📬',
  },
  {
    number: '5',
    title: 'We\'ll take it from here',
    description: 'Russell will sign and send back an official letterhead letter on Flowers for Fighters stationery — suitable for school, college, and scholarship applications.',
    icon: '✉️',
  },
]

export default function RequestLetterPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-background font-body" style={{ maxWidth: 480, margin: '0 auto' }}>

      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-8 pb-4">
        <button
          onClick={() => router.back()}
          className="text-charcoal/50 hover:text-charcoal transition-colors text-sm font-semibold flex items-center gap-1"
        >
          ← Back
        </button>
        <Logo size="sm" />
        <div className="w-12" /> {/* spacer */}
      </div>

      <div className="px-6 pb-24 space-y-6">

        {/* Hero */}
        <div className="text-center pt-2 pb-2 animate-fade-in-up">
          <span className="text-4xl mb-3 block">📋</span>
          <h1 className="font-display text-2xl font-bold text-charcoal mb-2">
            Request a Volunteer<br />Hours Letter
          </h1>
          <p className="font-body text-sm text-charcoal/60 leading-relaxed">
            Follow these steps and we'll send you an official signed letter on
            Flowers for Fighters letterhead — perfect for school and college applications.
          </p>
        </div>

        {/* Steps */}
        <div className="space-y-3">
          {steps.map((step, i) => (
            <div
              key={step.number}
              className="bg-white rounded-3xl p-5 border border-cream-dark animate-fade-in-up"
              style={{ animationDelay: `${i * 0.07}s` }}
            >
              <div className="flex items-start gap-4">
                <div className="w-9 h-9 rounded-full bg-blush flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="font-display font-bold text-primary text-sm">{step.number}</span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-base">{step.icon}</span>
                    <h3 className="font-body font-bold text-charcoal text-sm">{step.title}</h3>
                  </div>
                  <p className="font-body text-sm text-charcoal/60 leading-relaxed">{step.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Email CTA */}
        <div className="bg-blush rounded-3xl p-5 border border-primary/20 animate-fade-in-up text-center">
          <p className="font-body text-xs text-charcoal/50 mb-1">Send your impact card to</p>
          <a
            href="mailto:joinflowersforfighters@gmail.com?subject=Volunteer%20Hours%20Letter%20Request"
            className="font-body font-bold text-primary text-sm break-all"
          >
            joinflowersforfighters@gmail.com
          </a>
          <p className="font-body text-xs text-charcoal/40 mt-2">
            We typically respond within 2–3 business days 🌸
          </p>
        </div>

        {/* Back to Impact button */}
        <button
          onClick={() => router.push('/impact')}
          className="w-full py-4 rounded-2xl bg-primary text-white font-body font-bold text-base"
          style={{ boxShadow: '0 4px 24px rgba(232, 99, 122, 0.35)' }}
        >
          Go to My Impact 🌸
        </button>

      </div>
    </div>
  )
}
