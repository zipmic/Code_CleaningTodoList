// Formats elapsed seconds as mm:ss, or h:mm:ss when >= 1 hour.
function formatTime(seconds) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

// Sticky bar fixed to the bottom of the screen.
// In setup mode: shows the "Ready?" button (disabled until photos are added).
// In cleanup mode: shows the live stopwatch.
export default function TimerBar({ mode, elapsed, taskCount, onReady }) {
  if (mode === 'complete') return null

  return (
    <div className="timer-bar" role="complementary" aria-label="Cleanup controls">
      {mode === 'setup' ? (
        <button
          className={`ready-btn ${taskCount > 0 ? 'ready-btn--active' : ''}`}
          onClick={onReady}
          disabled={taskCount === 0}
          aria-disabled={taskCount === 0}
        >
          {taskCount === 0 ? '📷 Add photos to start!' : '🚀 Ready? Let\'s Go!'}
        </button>
      ) : (
        <div className="stopwatch" aria-live="polite" aria-atomic="true">
          <span className="stopwatch__label">⏱ Time</span>
          <span className="stopwatch__time">{formatTime(elapsed)}</span>
        </div>
      )}
    </div>
  )
}
