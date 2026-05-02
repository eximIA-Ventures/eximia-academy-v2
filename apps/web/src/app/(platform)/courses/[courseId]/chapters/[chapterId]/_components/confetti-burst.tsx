"use client"

import { useEffect, useState } from "react"

const COLORS = ["#2a6ab0", "#2dd4bf", "#f59e0b", "#a855f7", "#ef4444", "#22c55e", "#ec4899", "#3b82f6"]
const PARTICLE_COUNT = 60

interface Particle {
  id: number
  x: number
  color: string
  delay: number
  duration: number
  drift: number
  size: number
  rotation: number
}

function generateParticles(): Particle[] {
  return Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    delay: Math.random() * 0.5,
    duration: 1.5 + Math.random() * 2,
    drift: (Math.random() - 0.5) * 200,
    size: 4 + Math.random() * 6,
    rotation: Math.random() * 360,
  }))
}

interface ConfettiBurstProps {
  trigger: boolean
  onComplete?: () => void
}

export function ConfettiBurst({ trigger, onComplete }: ConfettiBurstProps) {
  const [particles, setParticles] = useState<Particle[]>([])
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!trigger) return
    setParticles(generateParticles())
    setVisible(true)
    const timer = setTimeout(() => {
      setVisible(false)
      onComplete?.()
    }, 3500)
    return () => clearTimeout(timer)
  }, [trigger, onComplete])

  if (!visible) return null

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute animate-confetti-fall"
          style={{
            left: `${p.x}%`,
            top: "-10px",
            width: `${p.size}px`,
            height: `${p.size * 0.6}px`,
            backgroundColor: p.color,
            borderRadius: "2px",
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            transform: `rotate(${p.rotation}deg)`,
            // @ts-expect-error custom property
            "--drift": `${p.drift}px`,
          }}
        />
      ))}
      <style jsx>{`
        @keyframes confetti-fall {
          0% {
            transform: translateY(0) translateX(0) rotate(0deg) scale(1);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) translateX(var(--drift)) rotate(720deg) scale(0.5);
            opacity: 0;
          }
        }
        .animate-confetti-fall {
          animation: confetti-fall linear forwards;
        }
      `}</style>
    </div>
  )
}
