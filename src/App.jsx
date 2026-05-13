import { useState, useEffect, useRef, useCallback } from 'react'
import PhotoTask from './components/PhotoTask'
import TimerBar from './components/TimerBar'
import VictoryModal from './components/VictoryModal'
import './App.css'

const STORAGE_KEY = 'cleanup-quest-v2'

// Resize an image to ≤ maxPx on its longest edge and return a JPEG data URL.
// Uses createImageBitmap with { imageOrientation: 'from-image' } so EXIF
// rotation from phone cameras is applied (otherwise portrait photos render
// sideways after canvas re-encoding). Falls back to FileReader + <img> on
// browsers that don't support the option.
async function resizeImage(file, maxPx = 800) {
  let source, width, height, isBitmap = false
  try {
    source = await createImageBitmap(file, { imageOrientation: 'from-image' })
    width = source.width
    height = source.height
    isBitmap = true
  } catch {
    source = await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const img = new Image()
        img.onload = () => resolve(img)
        img.onerror = () => reject(new Error('image decode failed'))
        img.src = e.target.result
      }
      reader.onerror = () => reject(new Error('file read failed'))
      reader.readAsDataURL(file)
    })
    width = source.naturalWidth
    height = source.naturalHeight
  }

  if (width > height) {
    if (width > maxPx) { height = Math.round((height * maxPx) / width); width = maxPx }
  } else {
    if (height > maxPx) { width = Math.round((width * maxPx) / height); height = maxPx }
  }

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  canvas.getContext('2d').drawImage(source, 0, 0, width, height)
  if (isBitmap) source.close()
  return canvas.toDataURL('image/jpeg', 0.72)
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    // If a previous save hit the quota and stripped image data, drop those
    // tasks now so we don't render broken <img> tags.
    if (parsed?.tasks) {
      parsed.tasks = parsed.tasks.filter(t => t && t.dataUrl)
    }
    return parsed
  } catch {
    return null
  }
}

// Returns 'ok' | 'lite' | 'fail' so the caller can show a one-time warning
// when we had to drop image data to stay under the localStorage quota.
function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    return 'ok'
  } catch {
    // Quota exceeded. Retry without dataUrls so mode/timer state at least
    // survives a refresh; tasks will reload empty and the user can re-add.
    try {
      const lite = {
        ...state,
        tasks: state.tasks.map(t => ({ id: t.id, completed: t.completed, dataUrl: null })),
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lite))
      return 'lite'
    } catch {
      return 'fail'
    }
  }
}

export default function App() {
  const [tasks, setTasks] = useState(() => loadState()?.tasks || [])
  const [mode, setMode] = useState(() => loadState()?.mode || 'setup')
  const [startTime, setStartTime] = useState(() => loadState()?.startTime ?? null)
  const [endTime, setEndTime] = useState(() => loadState()?.endTime ?? null)
  const [elapsed, setElapsed] = useState(0)
  const [notice, setNotice] = useState(null)

  const timerRef = useRef(null)
  const completionTimeoutRef = useRef(null)
  const fileInputRef = useRef(null)
  // Avoid re-warning on every keystroke once the user knows storage is full
  const quotaWarnedRef = useRef(false)

  // Persist whenever any tracked state changes. If localStorage is too full
  // for the photos, surface that to the user once so they know the photos
  // won't survive a refresh.
  useEffect(() => {
    const result = saveState({ tasks, mode, startTime, endTime })
    if (result !== 'ok' && !quotaWarnedRef.current) {
      quotaWarnedRef.current = true
      setNotice('Storage is full — photos may not survive a refresh.')
    }
  }, [tasks, mode, startTime, endTime])

  // Auto-dismiss any notice after a few seconds.
  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(null), 4000)
    return () => clearTimeout(t)
  }, [notice])

  // Derive elapsed from wall-clock timestamps. While in cleanup mode we
  // re-read Date.now() on a 250 ms tick; in complete mode the value is
  // frozen at endTime.
  useEffect(() => {
    if (!startTime) { setElapsed(0); return }
    const tick = () => {
      const end = endTime ?? Date.now()
      setElapsed(Math.max(0, Math.floor((end - startTime) / 1000)))
    }
    tick()
    if (mode === 'cleanup') {
      timerRef.current = setInterval(tick, 250)
    }
    return () => clearInterval(timerRef.current)
  }, [mode, startTime, endTime])

  // Auto-complete once every task is done. The 600 ms delay lets the final
  // emoji burst finish before the modal appears. The cleanup function
  // cancels the pending transition if the user un-marks a task during that
  // window.
  useEffect(() => {
    if (mode !== 'cleanup') return
    if (tasks.length === 0) return
    if (!tasks.every(t => t.completed)) return
    completionTimeoutRef.current = setTimeout(() => {
      setEndTime(Date.now())
      setMode('complete')
    }, 600)
    return () => clearTimeout(completionTimeoutRef.current)
  }, [tasks, mode])

  const handleFileChange = useCallback(async (e) => {
    const files = Array.from(e.target.files)
    if (!files.length) return
    let failed = 0
    for (const file of files) {
      try {
        const dataUrl = await resizeImage(file)
        setTasks(prev => [
          ...prev,
          { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, dataUrl, completed: false },
        ])
      } catch (err) {
        // HEIC on unsupported browsers, corrupt files, etc.
        console.warn('Skipping unreadable image:', err)
        failed++
      }
    }
    if (failed > 0) {
      setNotice(`Couldn't read ${failed} ${failed === 1 ? 'photo' : 'photos'}.`)
    }
    e.target.value = ''
  }, [])

  const handleToggle = useCallback((id) => {
    // Tasks are only interactive once the user has tapped Ready, so a child
    // can't pre-complete everything and trigger an instant 0:00 victory.
    if (mode !== 'cleanup') return
    setTasks(prev =>
      prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t)
    )
  }, [mode])

  const handleDelete = useCallback((id) => {
    setTasks(prev => prev.filter(t => t.id !== id))
  }, [])

  const handleReady = useCallback(() => {
    setStartTime(Date.now())
    setEndTime(null)
    setMode('cleanup')
  }, [])

  const handleReset = useCallback(() => {
    clearInterval(timerRef.current)
    clearTimeout(completionTimeoutRef.current)
    quotaWarnedRef.current = false
    setTasks([])
    setStartTime(null)
    setEndTime(null)
    setElapsed(0)
    setMode('setup')
    setNotice(null)
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

      {notice && (
        <div className="notice" role="status" aria-live="polite">{notice}</div>
      )}

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
                // Only pass onDelete in setup mode — the delete button
                // hides itself when this prop is undefined.
                onDelete={mode === 'setup' ? handleDelete : undefined}
                interactive={mode === 'cleanup'}
              />
            ))}
          </div>
        )}

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
