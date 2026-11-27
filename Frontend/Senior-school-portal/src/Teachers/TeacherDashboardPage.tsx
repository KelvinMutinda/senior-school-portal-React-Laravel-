import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import TeacherDashboard, { type TeacherData } from './TeacherDashboard'
import { apiUrl, authHeaders, getUser } from '../api/authApi' // adjust the paths to where these files live

interface DashboardResponse {
  teacherName: string
  data: TeacherData
}

export default function TeacherDashboardPage() {
  const navigate = useNavigate()
  const user = useMemo(() => getUser(), [])
  const [result, setResult] = useState<DashboardResponse | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async (signal?: AbortSignal) => {
    setError('')
    try {
      const res = await fetch(apiUrl('/teacher/dashboard'), { headers: authHeaders(), signal })
      if (res.status === 401) throw new Error('Your session has ended. Please sign in again.')
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.message || `Could not load your dashboard (${res.status}).`)
      }
      setResult((await res.json()) as DashboardResponse)
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      setError(
        err instanceof TypeError
          ? 'Could not reach the server. Check that the backend is running.'
          : err instanceof Error
            ? err.message
            : 'Could not load your dashboard.',
      )
    }
  }, [])

  useEffect(() => {
    const ctl = new AbortController()
    void load(ctl.signal)
    return () => ctl.abort()
  }, [load])

  if (error) {
    return (
      <div role="alert">
        {error} <button onClick={() => void load()}>Retry</button>
      </div>
    )
  }
  if (!result) return <p role="status">Loading your dashboard…</p>

  return (
    <TeacherDashboard
      data={result.data}
      user={{ name: result.teacherName || user?.name || 'Teacher', roleLabel: 'Subject teacher' }}
      onNavigate={(route) => navigate(route)}
    />
  )
}