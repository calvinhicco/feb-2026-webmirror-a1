"use client"

import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  auth,
  db,
  findStudentCandidatesByName,
  getParentProfile,
  linkStudentToParentProfile,
  loginParent,
  logoutParent,
  onAuthChange,
  registerParent,
  subscribeLatestProgressReportForStudent,
  type ParentProfile,
  type ProgressReportDoc,
  type StudentCandidate,
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
  const [studentName, setStudentName] = useState('')
  const [authError, setAuthError] = useState('')
  const [authBusy, setAuthBusy] = useState(false)

  const [profile, setProfile] = useState<ParentProfile | null>(null)
  const [selectedStudentId, setSelectedStudentId] = useState<string>('')
  const [report, setReport] = useState<ProgressReportDoc | null>(null)
  const [loadingReport, setLoadingReport] = useState(false)

  const [linkName, setLinkName] = useState('')
  const [linkBusy, setLinkBusy] = useState(false)
  const [linkError, setLinkError] = useState('')

  const [candidates, setCandidates] = useState<StudentCandidate[]>([])
  const [candidateBusy, setCandidateBusy] = useState(false)

  const reportRef = useRef<HTMLDivElement | null>(null)
  const [exportBusy, setExportBusy] = useState(false)

  useEffect(() => {
    const unsub = onAuthChange(async (user) => {
      setAuthError('')
      if (!user) {
        setAuthUserEmail('')
        setProfile(null)
        setSelectedStudentId('')
        setCandidates([])
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
    const first = profile?.studentIds?.[0] || ''
    setSelectedStudentId((prev) => {
      if (prev && profile?.studentIds?.includes(prev)) return prev
      return first
    })
  }, [profile?.studentIds])

  useEffect(() => {
    if (!selectedStudentId) {
      setReport(null)
      return
    }

    setLoadingReport(true)
    const unsub = subscribeLatestProgressReportForStudent(selectedStudentId, (doc) => {
      setReport(doc)
      setLoadingReport(false)
    })

    return () => {
      if (unsub) unsub()
    }
  }, [selectedStudentId])

  const canRegister = useMemo(() => {
    return safeTrim(email) && safeTrim(password) && safeTrim(studentName)
  }, [email, password, studentName])

  const canLogin = useMemo(() => {
    return safeTrim(email) && safeTrim(password)
  }, [email, password])

  const handleAuth = async () => {
    setAuthError('')
    setAuthBusy(true)
    setCandidates([])

    try {
      if (authMode === 'register') {
        if (!canRegister) {
          setAuthError('Email, password, and student name are required.')
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

        setCandidateBusy(true)
        const found = await findStudentCandidatesByName(safeTrim(studentName))
        setCandidateBusy(false)
        setCandidates(found)

        if (found.length === 0) {
          setAuthError('No matching student found. Make sure a progress report has been synced for that student name.')
          return
        }

        if (found.length > 1) {
          setAuthError('Multiple students found with that name. Please select the correct student.')
          return
        }

        const chosen = found[0]
        await registerParent({ email: safeTrim(email), password: safeTrim(password), studentId: chosen.studentId })
        setPassword('')
        setStudentName('')
        setCandidates([])
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
    setStudentName('')
    setLinkName('')
    setLinkError('')
    setCandidates([])
    setAuthMode('login')
  }

  const linkedStudentIds = useMemo(() => {
    return Array.isArray(profile?.studentIds) ? profile!.studentIds : []
  }, [profile?.studentIds])

  const resolveAndLinkByName = async (name: string) => {
    setLinkError('')
    const user = auth.currentUser
    if (!user) return

    setLinkBusy(true)
    try {
      const found = await findStudentCandidatesByName(safeTrim(name))
      if (found.length === 0) {
        setLinkError('No matching student found. Make sure a progress report has been synced for that student name.')
        return
      }
      if (found.length > 1) {
        setLinkError('Multiple students found with that name. Please use a more specific name or confirm in the desktop app.')
        return
      }

      const chosen = found[0]
      await linkStudentToParentProfile(user.uid, chosen.studentId)
      const updated = await getParentProfile(user.uid)
      setProfile(updated)
      setSelectedStudentId(chosen.studentId)
      setLinkName('')
    } finally {
      setLinkBusy(false)
    }
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
              Register once, then link one or more children. You will only see the latest progress report for the children you linked.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email" />
              <Input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" type="password" />
            </div>

            {authMode === 'register' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Input value={studentName} onChange={(e) => setStudentName(e.target.value)} placeholder="Student Name" />
              </div>
            ) : null}

            {authMode === 'register' && candidates.length > 1 ? (
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">Select student:</div>
                <div className="space-y-2">
                  {candidates.map((c) => (
                    <button
                      key={c.studentId}
                      type="button"
                      className="w-full text-left border rounded-md p-3 hover:bg-purple-50"
                      onClick={async () => {
                        setAuthBusy(true)
                        try {
                          await registerParent({ email: safeTrim(email), password: safeTrim(password), studentId: c.studentId })
                          setPassword('')
                          setStudentName('')
                          setCandidates([])
                        } finally {
                          setAuthBusy(false)
                        }
                      }}
                    >
                      <div className="text-sm font-medium">{c.studentName}</div>
                      <div className="text-xs text-muted-foreground">ID: {c.studentId}{c.className ? ` · ${c.className}` : ''}</div>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {authError ? <div className="text-sm text-destructive">{authError}</div> : null}
            {authMode === 'register' && candidateBusy ? <div className="text-sm text-muted-foreground">Searching student…</div> : null}

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

      {authUserEmail && (!profile || linkedStudentIds.length === 0) ? (
        <Card>
          <CardHeader>
            <CardTitle>No Child Linked Yet</CardTitle>
            <CardDescription>
              This account is logged in, but no student is linked yet. Add your child by student name.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input value={linkName} onChange={(e) => setLinkName(e.target.value)} placeholder="Student Name" />
              <Button onClick={() => resolveAndLinkByName(linkName)} disabled={linkBusy || !safeTrim(linkName)}>
                Link Child
              </Button>
            </div>
            {linkError ? <div className="text-sm text-destructive">{linkError}</div> : null}
          </CardContent>
        </Card>
      ) : null}

      {authUserEmail && profile && linkedStudentIds.length > 0 ? (
        <>
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              <div>Linked Children: {linkedStudentIds.length}</div>
              <div className="pt-2">
                <label className="text-xs text-muted-foreground">Select Child</label>
                <select
                  className="ml-2 border rounded-md px-2 py-1 text-sm"
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                >
                  {linkedStudentIds.map((sid) => (
                    <option key={sid} value={sid}>
                      {sid}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <Button onClick={downloadJpg} disabled={!report || exportBusy}>
              Download JPG
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Link Another Child</CardTitle>
              <CardDescription>Enter the student name exactly as in the progress report.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Input value={linkName} onChange={(e) => setLinkName(e.target.value)} placeholder="Student Name" />
                <Button onClick={() => resolveAndLinkByName(linkName)} disabled={linkBusy || !safeTrim(linkName)}>
                  Link Child
                </Button>
              </div>
              {linkError ? <div className="text-sm text-destructive">{linkError}</div> : null}
            </CardContent>
          </Card>

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
