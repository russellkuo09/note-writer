'use client'

import { useEffect } from 'react'
import confetti from 'canvas-confetti'

interface ConfettiEffectProps {
  trigger: boolean
  onComplete?: () => void
}

export default function ConfettiEffect({ trigger, onComplete }: ConfettiEffectProps) {
  useEffect(() => {
    if (!trigger) return

    // Petal-shaped confetti in brand colors
    const colors = ['#E8637A', '#F9DDE0', '#7BAE8A', '#F5EFE6', '#FDFAF6']

    const end = Date.now() + 2000

    const frame = () => {
      confetti({
        particleCount: 6,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors,
        shapes: ['circle'],
        scalar: 0.8,
      })
      confetti({
        particleCount: 6,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors,
        shapes: ['circle'],
        scalar: 0.8,
      })

      if (Date.now() < end) {
        requestAnimationFrame(frame)
      } else {
        onComplete?.()
      }
    }

    frame()
  }, [trigger, onComplete])

  return null
}
