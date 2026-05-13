import { useState, useEffect, useRef, useCallback } from 'react'
import PhotoTask from './components/PhotoTask'
import TimerBar from './components/TimerBar'
import VictoryModal from './components/VictoryModal'
import './App.css'

const STORAGE_KEY = 'cleanup-quest-v1'

// Resize an image file to max 800px and return a compressed data URL.
// This keeps localStorage usage manageable (~50–150 KB per photo).
function resizeImage(file, maxPx = 800) {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        let { width, height } = img
        if (width > height) {
          if (width > maxPx) { height = Math.round((height * maxPx) / width); width = maxPx }
        } else {
          if (height > maxPx) { width = Math.round((width * maxPx) / height); height = maxPx }
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        canvas.getContext('2d').drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', 0.72))
      }
      img.src = e.target.result
    }
    reader.readAsDataURL(file)
  })
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function saveState(tasks) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks))
  } catch {
    // localStorage may be full if many large photos are added.
    // Images survive the session but won't persist across refresh.
    console.warn('localStorage full — photos will not survive a page refresh.')
  }
}

export default function App() {
  const [tasks, setTasks] = useState(() => loadState() || [])
  // mode: 'setup' | 'cleanup' | 'complete'
  const [mode, setMode] = useState('setup')
  const [elapsed, setElapsed] = useState(0)
  const timerRef = useRef(null)
  const fileInputRef = useRef(null)

  // Persist tasks whenever they change
  useEffect(() => { saveState(tasks) }, [tasks])

  // Tick the stopwatch while in cleanup mode
  useEffect(() => {
    if (mode === 'cleanup') {
      timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000)
    }
    return () => clearInterval(timerRef.current)
  }, [mode])

  // Auto-complete once every task is done
  useEffect(() => {
    if (mode === 'cleanup' && tasks.length > 0 && tasks.every(t => t.completed)) {
      clearInterval(timerRef.current)
      // Small delay so the last emoji burst is visible before modal appears
      setTimeout(() => setMode('complete'), 600)
    }
  }, [tasks, mode])

  const handleFileChange = useCallback(async (e) => {
    const files = Array.from(e.target.files)
    if (!files.length) return
    for (const file of files) {
      const dataUrl = await resizeImage(file)
      setTasks(prev => [
        ...prev,
        { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, dataUrl, completed: false },
      ])
    }
    // Reset so the same file can be added again
    e.target.value = ''
  }, [])

  const handleToggle = useCallback((id) => {
    setTasks(prev =>
      prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t)
    )
  }, [])

  const handleReady = useCallback(() => {
    setElapsed(0)
    setMode('cleanup')
  }, [])

  const handleReset = useCallback(() => {
    clearInterval(timerRef.current)
    setTasks([])
    setElapsed(0)
    setMode('setup')
    localStorage.removeItem(STORAGE_KEY)
  }, [])

  const completedCount = tasks.filter(t => t.completed).length
  const allDone = tasks.length > 0 && completedCount === tasks.length

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">🧹 Cleanup Quest</h1>
        {tasks.length > 0 && (
          <div className={`progress-badge ${allDone ? 'progress-badge--done' : ''}`}>
            {completedCount} / {tasks.length} done
          </div>
        )}
      </header>

      <main className="task-area">
        {tasks.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📷</div>
            <p className="empty-text">Take pictures of what needs cleaning!</p>
            <p className="empty-sub">Tap the button below to add your first photo</p>
          </div>
        ) : (
          <div className="task-grid">
            {tasks.map(task => (
              <PhotoTask
                key={task.id}
                task={task}
                onToggle={handleToggle}
              />
            ))}
          </div>
        )}

        {/* Add-photo button — only visible in setup mode */}
        {mode === 'setup' && (
          <button
            className="add-photo-btn"
            onClick={() => fileInputRef.current.click()}
            aria-label="Add a photo task"
          >
            <span className="add-photo-btn__icon">📷</span>
            <span>{tasks.length === 0 ? 'Add Photo' : 'Add Another Photo'}</span>
          </button>
        )}
      </main>

      {/* Hidden file input — capture="environment" opens the rear camera on mobile */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        style={{ display: 'none' }}
        aria-hidden="true"
      />

      <TimerBar
        mode={mode}
        elapsed={elapsed}
        taskCount={tasks.length}
        onReady={handleReady}
      />

      {mode === 'complete' && (
        <VictoryModal elapsed={elapsed} onReset={handleReset} />
      )}
    </div>
  )
}
