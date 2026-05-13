import { useMemo } from 'react'

const CONFETTI_EMOJIS = ['🎉', '⭐', '✨', '🧹', '🏆', '🌟', '💫', '🎊']

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

// Generates 36 confetti pieces with randomised horizontal position,
// animation duration, delay, and emoji so they look organic.
function useConfetti(count = 36) {
  return useMemo(() => (
    Array.from({ length: count }, (_, i) => ({
      id: i,
      emoji: CONFETTI_EMOJIS[i % CONFETTI_EMOJIS.length],
      left: `${Math.random() * 100}%`,
      duration: `${2.5 + Math.random() * 2.5}s`,
      delay: `${Math.random() * 2}s`,
      size: `${1.2 + Math.random() * 1.4}em`,
    }))
  ), [count])
}

export default function VictoryModal({ elapsed, onReset }) {
  const confetti = useConfetti()

  return (
    <div className="victory-backdrop" role="dialog" aria-modal="true" aria-label="You finished!">
      {/* Floating emoji confetti in the background */}
      <div className="confetti-layer" aria-hidden="true">
        {confetti.map(p => (
          <span
            key={p.id}
            className="confetti-piece"
            style={{
              left: p.left,
              fontSize: p.size,
              animationDuration: p.duration,
              animationDelay: p.delay,
            }}
          >
            {p.emoji}
          </span>
        ))}
      </div>

      {/* Modal card */}
      <div className="victory-card">
        <div className="victory-trophy" aria-hidden="true">🏆</div>
        <h2 className="victory-title">Good job!</h2>
        <p className="victory-sub">You cleaned everything up!</p>
        <div className="victory-time-block">
          <span className="victory-time-label">⏱ Finished in</span>
          <span className="victory-time">{formatTime(elapsed)}</span>
        </div>
        <button className="victory-reset-btn" onClick={onReset}>
          🔄 Start Over
        </button>
      </div>
    </div>
  )
}
