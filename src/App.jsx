import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import PhotoTask from './components/PhotoTask'
import TimerBar from './components/TimerBar'
import VictoryModal from './components/VictoryModal'
import './App.css'

// Two keys so we don't re-serialise multi-MB image data on every toggle.
// PHOTOS holds the heavy dataUrls; PROGRESS is small and may write often.
const PHOTOS_KEY = 'cleanup-quest-photos-v3'
const PROGRESS_KEY = 'cleanup-quest-progress-v3'

/* ─── Image processing ──────────────────────────────────────────────────── */

// Resize an image to ≤ maxPx on its longest edge and return a JPEG data URL.
// createImageBitmap with `imageOrientation: 'from-image'` applies EXIF
// rotation so portrait phone photos don't render sideways; FileReader is
// the fallback for browsers that don't support that option.
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

/* ─── Persistence ───────────────────────────────────────────────────────── */

function parseJSON(raw) {
  if (!raw) return null
  try { return JSON.parse(raw) } catch { return null }
}

// Combined load. Resolves the deadlock case (H2): if photo data was lost
// to a quota error and we'd otherwise restore a mid-cleanup session with
// no tasks, we reset everything to setup.
function loadInitialState() {
  const photos = parseJSON(localStorage.getItem(PHOTOS_KEY)) || []
  const progress = parseJSON(localStorage.getItem(PROGRESS_KEY)) || {}

  const completedSet = new Set(progress.completedIds || [])
  const tasks = photos
    .filter(p => p && p.dataUrl)
    .map(p => ({ id: p.id, dataUrl: p.dataUrl, completed: completedSet.has(p.id) }))

  let mode = progress.mode || 'setup'
  let startTime = progress.startTime ?? null
  let endTime = progress.endTime ?? null

  // H2: empty grid + non-setup mode is a dead-end — no Ready, no Reset.
  if (tasks.length === 0 && mode !== 'setup') {
    mode = 'setup'
    startTime = null
    endTime = null
  }

  return { tasks, mode, startTime, endTime }
}

// Returns 'ok' | 'lite' | 'fail'. Only called when the SET of task ids
// changes (add/remove), not on toggle, so we don't rewrite multi-MB
// payloads on every tap.
function savePhotos(photos) {
  const payload = photos.map(p => ({ id: p.id, dataUrl: p.dataUrl }))
  try {
    localStorage.setItem(PHOTOS_KEY, JSON.stringify(payload))
    return 'ok'
  } catch {
    try {
      // Quota hit: drop dataUrls. On reload, loadInitialState will see
      // these entries lack dataUrl and filter them out (which triggers
      // the H2 reset path if everything was lost).
      const lite = payload.map(p => ({ id: p.id, dataUrl: null }))
      localStorage.setItem(PHOTOS_KEY, JSON.stringify(lite))
      return 'lite'
    } catch {
      return 'fail'
    }
  }
}

function saveProgress(progress) {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress))
  } catch {
    // The progress payload is < 1 KB; if even this fails, localStorage
    // is unavailable (private mode in some browsers) — nothing to do.
  }
}

/* ─── Component ─────────────────────────────────────────────────────────── */

export default function App() {
  // Load once; one localStorage read instead of four.
  const initial = useMemo(loadInitialState, [])

  const [tasks, setTasks] = useState(initial.tasks)
  const [mode, setMode] = useState(initial.mode)
  const [startTime, setStartTime] = useState(initial.startTime)
  const [endTime, setEndTime] = useState(initial.endTime)
  const [elapsed, setElapsed] = useState(0)
  const [notice, setNotice] = useState(null)

  const timerRef = useRef(null)
  const completionTimeoutRef = useRef(null)
  const completingRef = useRef(false)
  const fileInputRef = useRef(null)
  const appRef = useRef(null)
  const quotaWarnedRef = useRef(false)
  // Tracks the ids we last persisted so the photo save effect can
  // skip writes that are pure completion-toggles.
  const lastSavedIdsRef = useRef(initial.tasks.map(t => t.id).join('|'))

  /* ── Persistence effects ───────────────────────────────────────────── */

  // Heavy save: only when the set of task ids changes (add / remove).
  useEffect(() => {
    const ids = tasks.map(t => t.id).join('|')
    if (ids === lastSavedIdsRef.current) return
    lastSavedIdsRef.current = ids

    const result = savePhotos(tasks)
    if (result !== 'ok' && !quotaWarnedRef.current) {
      quotaWarnedRef.current = true
      // M1: this notice takes precedence over the per-file decode message.
      setNotice('Storage is full — photos may not survive a refresh.')
    }
  }, [tasks])

  // Light save: every state change, but only ids + flags (< 1 KB).
  useEffect(() => {
    const completedIds = tasks.filter(t => t.completed).map(t => t.id)
    saveProgress({ mode, startTime, endTime, completedIds })
  }, [tasks, mode, startTime, endTime])

  // Auto-dismiss any notice after a few seconds.
  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(null), 4000)
    return () => clearTimeout(t)
  }, [notice])

  // M4: make the rest of the app non-interactive while the victory modal
  // is open. We set the attribute imperatively because React 18 doesn't
  // recognise `inert` as a JSX prop and would emit a dev warning.
  useEffect(() => {
    const el = appRef.current
    if (!el) return
    if (mode === 'complete') el.setAttribute('inert', '')
    else el.removeAttribute('inert')
  }, [mode])

  /* ── Stopwatch ─────────────────────────────────────────────────────── */

  // Elapsed comes from wall-clock timestamps, so it doesn't drift on
  // throttled tabs and survives a refresh. 1 Hz tick is enough for a
  // seconds display.
  useEffect(() => {
    if (!startTime) { setElapsed(0); return }
    const tick = () => {
      const end = endTime ?? Date.now()
      setElapsed(Math.max(0, Math.floor((end - startTime) / 1000)))
    }
    tick()
    if (mode === 'cleanup') {
      timerRef.current = setInterval(tick, 1000)
    }
    return () => clearInterval(timerRef.current)
  }, [mode, startTime, endTime])

  /* ── Auto-complete (M3 fix) ────────────────────────────────────────── */

  // We freeze endTime the moment "all done" is first detected, *before*
  // the 600 ms display delay. That way, if the user refreshes during
  // the delay (or hours later), the final time is the real finish time
  // — not "now minus startTime". A ref prevents re-scheduling when the
  // effect re-runs because we just set endTime.
  useEffect(() => {
    if (mode !== 'cleanup') return
    if (tasks.length === 0) return
    const allDone = tasks.every(t => t.completed)

    if (!allDone) {
      // User un-marked a task — cancel any pending completion.
      if (completionTimeoutRef.current) {
        clearTimeout(completionTimeoutRef.current)
        completionTimeoutRef.current = null
      }
      completingRef.current = false
      if (endTime !== null) setEndTime(null)
      return
    }

    if (completingRef.current) return
    completingRef.current = true

    const isResumingFromRefresh = endTime !== null
    if (!isResumingFromRefresh) setEndTime(Date.now())

    // No delay on a refresh; the user already missed (or saw) the burst.
    const delay = isResumingFromRefresh ? 0 : 600
    completionTimeoutRef.current = setTimeout(() => {
      completionTimeoutRef.current = null
      setMode('complete')
    }, delay)
  }, [tasks, mode, endTime])

  /* ── Handlers ──────────────────────────────────────────────────────── */

  // Batches all successful images into ONE setTasks call (H3) so the
  // photo save effect runs once for a multi-file pick instead of N times.
  const handleFileChange = useCallback(async (e) => {
    const files = Array.from(e.target.files)
    if (!files.length) return

    const additions = []
    let failed = 0
    for (const file of files) {
      try {
        const dataUrl = await resizeImage(file)
        additions.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          dataUrl,
          completed: false,
        })
      } catch (err) {
        failed++
      }
    }
    if (failed > 0) {
      // L6: one aggregated log instead of N.
      console.warn(`Skipped ${failed} unreadable image(s).`)
    }

    if (additions.length > 0) {
      setTasks(prev => [...prev, ...additions])
    }

    if (failed > 0) {
      // M1: a quota warning is more important — don't clobber it.
      setNotice(prev =>
        prev && prev.startsWith('Storage')
          ? prev
          : `Couldn't read ${failed} ${failed === 1 ? 'photo' : 'photos'}.`
      )
    }

    e.target.value = ''
  }, [])

  const handleToggle = useCallback((id) => {
    // Only interactive in cleanup mode — guards against the 0:00 victory.
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

  // Used both by the victory modal ("Start Over") and the in-cleanup
  // cancel button (M5).
  const handleReset = useCallback(() => {
    clearInterval(timerRef.current)
    clearTimeout(completionTimeoutRef.current)
    completionTimeoutRef.current = null
    completingRef.current = false
    quotaWarnedRef.current = false
    // Intentionally NOT clearing lastSavedIdsRef — leaving it as the
    // pre-reset id list means the photo save effect will detect that
    // tasks dropped to [] and overwrite PHOTOS_KEY with an empty array.
    setTasks([])
    setStartTime(null)
    setEndTime(null)
    setElapsed(0)
    setMode('setup')
    setNotice(null)
    // Persistence effects will write the empty state, so no explicit
    // removeItem is needed (it would be overwritten on the next tick
    // anyway — see L5).
  }, [])

  const completedCount = tasks.filter(t => t.completed).length
  const allDone = tasks.length > 0 && completedCount === tasks.length

  return (
    <>
      {/* M4: `inert` is set imperatively in a useEffect above. */}
      <div className="app" ref={appRef}>
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
                  onDelete={mode === 'setup' ? handleDelete : undefined}
                  interactive={mode === 'cleanup'}
                  mode={mode}
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
          onCancel={handleReset}
        />
      </div>

      {mode === 'complete' && (
        <VictoryModal elapsed={elapsed} onReset={handleReset} />
      )}
    </>
  )
}
