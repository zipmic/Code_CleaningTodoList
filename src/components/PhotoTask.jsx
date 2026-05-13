import { useState, useCallback } from 'react'
import EmojiBurst from './EmojiBurst'

export default function PhotoTask({ task, onToggle, onDelete, interactive }) {
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
    // Stop the click from bubbling to the card itself
    e.stopPropagation()
    onDelete(task.id)
  }, [task.id, onDelete])

  const classes = [
    'photo-task',
    task.completed && 'photo-task--done',
    !interactive && 'photo-task--locked',
  ].filter(Boolean).join(' ')

  return (
    <div
      className={classes}
      onClick={handleClick}
      role={interactive ? 'button' : 'img'}
      tabIndex={interactive ? 0 : -1}
      aria-pressed={interactive ? task.completed : undefined}
      aria-label={
        !interactive
          ? 'Cleanup task — tap Ready to start'
          : task.completed
            ? 'Task done — tap to undo'
            : 'Tap to mark as done'
      }
      onKeyDown={e => {
        if (!interactive) return
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          handleClick()
        }
      }}
    >
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

      {/* Delete button is only rendered when a handler is supplied
          (i.e. in setup mode) so it can't be hit during cleanup. */}
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
