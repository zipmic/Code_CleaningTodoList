import { useMemo } from 'react'

const BURST_EMOJIS = ['⭐', '🎉', '✨', '🧹', '🌟', '💫', '⭐', '✨']

// Renders 8 emoji particles that fly out from the centre of the card.
// Each particle gets a random direction, size, and delay so they feel organic.
export default function EmojiBurst() {
  const particles = useMemo(() => {
    return Array.from({ length: 8 }, (_, i) => {
      const angle = (i / 8) * 360 + Math.random() * 20 - 10
      // Distance is now larger because particles can escape the card
      // (the outer .photo-task is overflow:visible).
      const distance = 90 + Math.random() * 60   // px
      const rad = (angle * Math.PI) / 180
      const tx = Math.round(Math.cos(rad) * distance)
      const ty = Math.round(Math.sin(rad) * distance)
      const size = 1.2 + Math.random() * 0.8      // em
      const delay = Math.random() * 120            // ms
      const emoji = BURST_EMOJIS[i % BURST_EMOJIS.length]
      return { tx, ty, size, delay, emoji, id: i }
    })
  }, [])

  return (
    <div className="emoji-burst" aria-hidden="true">
      {particles.map(p => (
        <span
          key={p.id}
          className="emoji-burst__particle"
          style={{
            '--tx': `${p.tx}px`,
            '--ty': `${p.ty}px`,
            fontSize: `${p.size}em`,
            animationDelay: `${p.delay}ms`,
          }}
        >
          {p.emoji}
        </span>
      ))}
    </div>
  )
}
