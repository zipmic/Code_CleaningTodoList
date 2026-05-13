import { useState, useCallback } from 'react'
import EmojiBurst from './EmojiBurst'

export default function PhotoTask({ task, onToggle }) {
  const [bursting, setBursting] = useState(false)

  const handleClick = useCallback(() => {
    // Only burst when marking as complete (not when un-marking)
    if (!task.completed) {
      setBursting(true)
      setTimeout(() => setBursting(false), 900)
    }
    onToggle(task.id)
  }, [task.completed, task.id, onToggle])

  return (
    <div
      className={`photo-task ${task.completed ? 'photo-task--done' : ''}`}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      aria-pressed={task.completed}
      aria-label={task.completed ? 'Task done — tap to undo' : 'Tap to mark as done'}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') handleClick() }}
    >
      <img
        className="photo-task__img"
        src={task.dataUrl}
        alt="Cleanup task"
        draggable={false}
      />

      {/* Desaturation + done overlay */}
      {task.completed && (
        <div className="photo-task__overlay">
          <span className="photo-task__check" aria-hidden="true">✅</span>
        </div>
      )}

      {/* Emoji particles that fly out on completion */}
      {bursting && <EmojiBurst />}
    </div>
  )
}
