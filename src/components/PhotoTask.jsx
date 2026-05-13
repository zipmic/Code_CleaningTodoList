import { useState, useCallback, memo } from 'react'
import EmojiBurst from './EmojiBurst'

// PhotoTask re-renders 4×/sec during cleanup because the parent ticks the
// stopwatch. memo() short-circuits since props (task, callbacks) are stable.
function PhotoTask({ task, onToggle, onDelete, interactive, mode }) {
  const [bursting, setBursting] = useState(false)

  const handleClick = useCallback(() => {
    if (!interactive) return
    if (!task.completed) {
      setBursting(true)
      setTimeout(() => setBursting(false), 900)
    }
    onToggle(task.id)
  }, [interactive, task.completed, task.id, onToggle])

  const handleDelete = useCallback((e) => {
    e.stopPropagation()
    onDelete(task.id)
  }, [task.id, onDelete])

  // Pick a label that matches what tapping will actually do.
  let label
  if (mode === 'complete') label = 'Cleanup task — finished'
  else if (!interactive)   label = 'Cleanup task — tap Ready to start'
  else if (task.completed) label = 'Task done — tap to undo'
  else                     label = 'Tap to mark as done'

  const classes = [
    'photo-task',
    task.completed && 'photo-task--done',
    !interactive && 'photo-task--locked',
    bursting && 'photo-task--bursting',
  ].filter(Boolean).join(' ')

  return (
    <div
      className={classes}
      onClick={handleClick}
      role={interactive ? 'button' : 'img'}
      tabIndex={interactive ? 0 : -1}
      aria-pressed={interactive ? task.completed : undefined}
      aria-label={label}
      onKeyDown={e => {
        if (!interactive) return
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          handleClick()
        }
      }}
    >
      {/* Inner box clips the image to the rounded shape. The outer
          box stays overflow:visible so the emoji burst can fly outside
          the card boundary. */}
      <div className="photo-task__inner">
        <img
          className="photo-task__img"
          src={task.dataUrl}
          alt=""
          draggable={false}
        />
        {task.completed && (
          <div className="photo-task__overlay">
            <span className="photo-task__check" aria-hidden="true">✅</span>
          </div>
        )}
      </div>

      {onDelete && (
        <button
          type="button"
          className="photo-task__delete"
          onClick={handleDelete}
          aria-label="Remove this photo"
        >
          ×
        </button>
      )}

      {bursting && <EmojiBurst />}
    </div>
  )
}

export default memo(PhotoTask)
