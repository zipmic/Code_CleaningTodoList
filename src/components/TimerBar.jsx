import { formatTime } from '../utils/time'

export default function TimerBar({ mode, elapsed, taskCount, paused, onReady, onPause, onResume, onCancel }) {
  if (mode === 'complete') return null

  return (
    <div className={`timer-bar ${paused ? 'timer-bar--paused' : ''}`} role="complementary" aria-label="Cleanup controls">
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

          {/* Pause / resume button on the left */}
          <button
            type="button"
            className={`stopwatch__pause ${paused ? 'stopwatch__pause--paused' : ''}`}
            onClick={paused ? onResume : onPause}
            aria-label={paused ? 'Resume timer' : 'Pause timer'}
          >
            {paused ? '▶' : '⏸'}
          </button>

          {/* Time display in the centre */}
          <div className="stopwatch__centre">
            <span className="stopwatch__label">
              {paused ? '⏸ Paused' : '⏱ Time'}
            </span>
            <span className="stopwatch__time">{formatTime(elapsed)}</span>
          </div>

          {/* Cancel button on the right */}
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
