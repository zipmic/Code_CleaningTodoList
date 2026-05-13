import { formatTime } from '../utils/time'

// Sticky bar fixed to the bottom of the screen.
// In setup mode: shows the "Ready?" button (disabled until photos are added).
// In cleanup mode: shows the live stopwatch and a small cancel button.
export default function TimerBar({ mode, elapsed, taskCount, onReady, onCancel }) {
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
          {/* M5: small escape hatch so a session started by mistake
              (or an abandoned cleanup) isn't a dead end. */}
          <button
            type="button"
            className="stopwatch__cancel"
            onClick={onCancel}
            aria-label="Cancel cleanup and start over"
            title="Cancel cleanup"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  )
}
