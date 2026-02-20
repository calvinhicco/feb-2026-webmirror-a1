"use client"

import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  getParentProfile,
  loginParent,
  logoutParent,
  onAuthChange,
  registerParent,
  subscribeLatestProgressReportForStudent,
  type ParentProfile,
  type ProgressReportDoc,
} from '@/lib/firebase'

const safeTrim = (v: string) => String(v || '').trim()

const isLikelyEmail = (value: string) => {
  const v = safeTrim(value)
  return v.includes('@') && v.includes('.')
}

const formatDateTime = (iso: string) => {
  try {
    if (!safeTrim(iso)) return 'N/A'
    return new Date(iso).toLocaleString()
  } catch {
    return 'N/A'
  }
}

const formatDate = (iso: string) => {
  try {
    if (!safeTrim(iso)) return new Date().toLocaleDateString()
    return new Date(iso).toLocaleDateString()
  } catch {
    return new Date().toLocaleDateString()
  }
}

export default function ProgressReportPage() {
  const [authUserEmail, setAuthUserEmail] = useState<string>('')
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [studentId, setStudentId] = useState('')
  const [authError, setAuthError] = useState('')
  const [authBusy, setAuthBusy] = useState(false)

  const [profile, setProfile] = useState<ParentProfile | null>(null)
  const [report, setReport] = useState<ProgressReportDoc | null>(null)
  const [loadingReport, setLoadingReport] = useState(false)

  const reportRef = useRef<HTMLDivElement | null>(null)
  const [exportBusy, setExportBusy] = useState(false)

  useEffect(() => {
    const unsub = onAuthChange(async (user) => {
      setAuthError('')
      if (!user) {
        setAuthUserEmail('')
        setProfile(null)
        setReport(null)
        return
      }

      setAuthUserEmail(user.email || '')
      const p = await getParentProfile(user.uid)
      setProfile(p)
    })

    return () => {
      if (unsub) unsub()
    }
  }, [])

  useEffect(() => {
    if (!profile?.studentId) {
      setReport(null)
      return
    }

    setLoadingReport(true)
    const unsub = subscribeLatestProgressReportForStudent(profile.studentId, (doc) => {
      setReport(doc)
      setLoadingReport(false)
    })

    return () => {
      if (unsub) unsub()
    }
  }, [profile?.studentId])

  const canRegister = useMemo(() => {
    return safeTrim(email) && safeTrim(password) && safeTrim(studentId)
  }, [email, password, studentId])

  const canLogin = useMemo(() => {
    return safeTrim(email) && safeTrim(password)
  }, [email, password])

  const handleAuth = async () => {
    setAuthError('')
    setAuthBusy(true)

    try {
      if (authMode === 'register') {
        if (!canRegister) {
          setAuthError('Email, password, and student ID are required.')
          return
        }
        if (!isLikelyEmail(email)) {
          setAuthError('Please enter a valid email address.')
          return
        }
        if (safeTrim(password).length < 6) {
          setAuthError('Password must be at least 6 characters (Firebase requirement).')
          return
        }
        await registerParent({ email: safeTrim(email), password: safeTrim(password), studentId: safeTrim(studentId) })
        setPassword('')
        return
      }

      if (!canLogin) {
        setAuthError('Email and password are required.')
        return
      }

      if (!isLikelyEmail(email)) {
        setAuthError('Please enter a valid email address.')
        return
      }

      await loginParent(safeTrim(email), safeTrim(password))
      setPassword('')
    } catch (err: any) {
      const code = typeof err?.code === 'string' ? err.code : ''
      const msg = typeof err?.message === 'string' ? err.message : 'Authentication failed'
      setAuthError(code ? `${code}: ${msg}` : msg)
    } finally {
      setAuthBusy(false)
    }
  }

  const downloadJpg = async () => {
    try {
      if (!reportRef.current) return
      setExportBusy(true)

      const mod = await import('html-to-image')
      const dataUrl = await (mod as any).toJpeg(reportRef.current, {
        quality: 0.95,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
      })

      const a = document.createElement('a')
      a.href = dataUrl
      const safeStudent = safeTrim(report?.studentName || 'Student').replace(/\s+/g, ' ')
      const safeYear = safeTrim(report?.academicYear || '')
      const safeTerm = safeTrim(report?.term || '')
      a.download = `${safeStudent} - ${safeYear} - ${safeTerm} - Progress Report.jpg`.replace(/\s+/g, ' ')
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    } finally {
      setExportBusy(false)
    }
  }

  const handleLogout = async () => {
    await logoutParent()
    setEmail('')
    setPassword('')
    setStudentId('')
    setAuthMode('login')
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Progress Report</h1>
        {authUserEmail ? (
          <div className="flex items-center gap-3">
            <div className="text-sm text-muted-foreground">{authUserEmail}</div>
            <Button variant="outline" onClick={handleLogout} className="bg-transparent">
              Logout
            </Button>
          </div>
        ) : null}
      </div>

      {!authUserEmail ? (
        <Card>
          <CardHeader>
            <CardTitle>{authMode === 'login' ? 'Parent Login' : 'Parent Registration'}</CardTitle>
            <CardDescription>
              Register once, then you will only see the latest progress report for the student ID you entered.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email" />
              <Input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" type="password" />
            </div>

            {authMode === 'register' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Input value={studentId} onChange={(e) => setStudentId(e.target.value)} placeholder="Student ID" />
              </div>
            ) : null}

            {authError ? <div className="text-sm text-destructive">{authError}</div> : null}

            <div className="flex items-center gap-3">
              <Button onClick={handleAuth} disabled={authBusy || (authMode === 'login' ? !canLogin : !canRegister)}>
                {authMode === 'login' ? 'Login' : 'Register'}
              </Button>
              <button
                type="button"
                className="text-sm text-primary underline"
                onClick={() => {
                  setAuthMode((prev) => (prev === 'login' ? 'register' : 'login'))
                  setAuthError('')
                }}
              >
                {authMode === 'login' ? 'New parent? Register' : 'Have an account? Login'}
              </button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {authUserEmail && !profile?.studentId ? (
        <Card>
          <CardHeader>
            <CardTitle>Account Setup Incomplete</CardTitle>
            <CardDescription>
              This account is logged in, but no student ID is attached. Please logout and register again.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {authUserEmail && profile?.studentId ? (
        <>
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">Student ID: {profile.studentId}</div>
            <Button onClick={downloadJpg} disabled={!report || exportBusy}>
              Download JPG
            </Button>
          </div>

          {loadingReport ? (
            <Card>
              <CardContent className="py-8 text-sm text-muted-foreground">Loading latest progress report…</CardContent>
            </Card>
          ) : !report ? (
            <Card>
              <CardHeader>
                <CardTitle>No Progress Report Found</CardTitle>
                <CardDescription>
                  No progress report has been synced for this student yet. Ask the school to sync the latest report from the desktop app.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : (
            <div className="bg-white">
              <div
                ref={reportRef}
                className="mx-auto w-full max-w-[900px] bg-white"
              >
                <div className="relative mx-auto w-full bg-white border rounded-lg overflow-hidden">
                  {report.parentCopy ? (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <div className="text-gray-200 font-bold text-6xl rotate-[-25deg] select-none">PARENT COPY</div>
                    </div>
                  ) : null}

                  <div className="relative p-6 space-y-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <div className="text-xl font-semibold text-gray-900">{report.schoolName || 'Progress Report'}</div>
                        <div className="text-sm text-muted-foreground">{report.academicYear} — {report.term}</div>
                      </div>
                      {report.logoBase64 ? (
                        <img src={report.logoBase64} alt="School Logo" className="h-16 w-auto object-contain" />
                      ) : null}
                    </div>

                    <div className="h-[2px] w-full bg-purple-600" />

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
                      <div><span className="text-muted-foreground">Student Name:</span> {report.studentName}</div>
                      <div><span className="text-muted-foreground">Class:</span> {report.className || 'N/A'}</div>
                      <div><span className="text-muted-foreground">Date:</span> {formatDate(report.updatedAtIso)}</div>
                      <div className="md:col-span-2"><span className="text-muted-foreground">Class Teacher Name:</span> {report.teacherName || 'N/A'}</div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-sm border border-gray-200 border-collapse">
                        <thead>
                          <tr className="bg-purple-600 text-white">
                            <th className="text-left py-2 px-3 font-medium">Subject</th>
                            <th className="text-left py-2 px-3 font-medium">Percentage</th>
                            <th className="text-left py-2 px-3 font-medium">Grade</th>
                            <th className="text-left py-2 px-3 font-medium">Result</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(report.results || []).map((r, idx) => {
                            const passFail = ['A', 'B', 'C'].includes(String(r.grade || '').toUpperCase()) ? 'Pass' : 'Fail'
                            const bg = idx % 2 === 0 ? 'bg-white' : 'bg-purple-50'
                            return (
                              <tr key={`${r.subject}-${idx}`} className={`border-t border-gray-200 ${bg}`}>
                                <td className="py-2 px-3">{r.subject}</td>
                                <td className="py-2 px-3">{Number.isFinite(r.percentage) ? `${r.percentage}%` : '—'}</td>
                                <td className="py-2 px-3">{r.grade}</td>
                                <td className="py-2 px-3">{passFail}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <div className="text-sm font-medium text-gray-900">Teacher’s Comment:</div>
                        <div className="min-h-[70px] border border-gray-200 rounded-md p-3 text-sm text-gray-700 whitespace-pre-wrap bg-white">
                          {safeTrim(report.teacherComment || '') || 'N/A'}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="text-sm font-medium text-gray-900">Updated:</div>
                        <div className="text-sm text-muted-foreground">{formatDateTime(report.updatedAtIso)}</div>
                        {report.useClassPosition ? (
                          <div className="text-xs text-muted-foreground pt-2">
                            Position in class is enabled in the desktop app, but the web mirror shows only the latest report for this student.
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="pt-4 border-t border-gray-200">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-2">
                          <div className="text-sm font-medium text-gray-900">Class Teacher</div>
                          <div className="text-sm text-gray-700">{report.teacherName || ''}</div>
                          <div className="h-px bg-gray-400" />
                          <div className="text-xs text-muted-foreground">Signature</div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <div className="text-sm font-medium text-gray-900">Head Teacher</div>
                              <div className="text-sm text-gray-700"> </div>
                            </div>
                            {report.schoolStamp ? (
                              <img src={report.schoolStamp} alt="School Stamp" className="h-20 w-auto object-contain" />
                            ) : null}
                          </div>
                          <div className="h-px bg-gray-400" />
                          <div className="text-xs text-muted-foreground">Signature</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      ) : null}
    </div>
  )
}
