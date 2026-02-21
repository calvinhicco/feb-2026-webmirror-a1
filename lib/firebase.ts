import { initializeApp } from 'firebase/app'
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, type User } from 'firebase/auth'
import {
  getFirestore,
  collection,
  onSnapshot,
  doc,
  getDocs,
  getDoc,
  setDoc,
  query,
  orderBy,
  where,
  limit,
  enableNetwork,
  disableNetwork,
  clearIndexedDbPersistence,
  type Unsubscribe,
} from 'firebase/firestore'

// Firebase configuration - matches the Electron app's Firebase project
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyBd20WWDh_uXn94JNUBbjenXJWmuVLf23U",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "feb-2026-webmirror-a1.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "feb-2026-webmirror-a1",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "feb-2026-webmirror-a1.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "832639056155",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:832639056155:web:757d7122c7714763487bbe",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-LHWKCD9RZ7",
}

// Initialize Firebase
const app = initializeApp(firebaseConfig)
const db = getFirestore(app)
const auth = getAuth(app)

if (typeof window !== 'undefined') {
  console.log('[Firebase] Using project:', {
    projectId: firebaseConfig.projectId,
    authDomain: firebaseConfig.authDomain,
  })
}

export { db, auth }

export type ParentProfile = {
  uid: string
  studentIds: string[]
  createdAtIso: string
}

export const onAuthChange = (cb: (user: User | null) => void): Unsubscribe => {
  return onAuthStateChanged(auth, cb)
}

export const loginParent = async (email: string, password: string) => {
  return await signInWithEmailAndPassword(auth, email, password)
}

export const registerParent = async (config: { email: string; password: string; studentId: string }) => {
  const cred = await createUserWithEmailAndPassword(auth, config.email, config.password)
  const uid = cred.user.uid
  const sid = String(config.studentId || '').trim()
  const profile: ParentProfile = {
    uid,
    studentIds: sid ? [sid] : [],
    createdAtIso: new Date().toISOString(),
  }
  await setDoc(doc(db, 'parentProfiles', uid), profile, { merge: true })
  return cred
}

export const logoutParent = async () => {
  await signOut(auth)
}

export const getParentProfile = async (uid: string): Promise<ParentProfile | null> => {
  const snap = await getDoc(doc(db, 'parentProfiles', uid))
  if (!snap.exists()) return null
  const raw = snap.data() as any
  const studentIds = Array.isArray(raw?.studentIds)
    ? raw.studentIds.filter((x: any) => typeof x === 'string' && String(x).trim())
    : typeof raw?.studentId === 'string' && raw.studentId.trim()
      ? [raw.studentId.trim()]
      : []

  return {
    ...(raw || {}),
    uid: snap.id,
    studentIds,
    createdAtIso: typeof raw?.createdAtIso === 'string' ? raw.createdAtIso : new Date().toISOString(),
  } as ParentProfile
}

export type StudentCandidate = {
  studentId: string
  studentName: string
  className?: string
}

const normalizeName = (name: string) => String(name || '').trim().toLowerCase().replace(/\s+/g, ' ')

export const findStudentCandidatesByName = async (studentName: string, maxScan = 2000): Promise<StudentCandidate[]> => {
  const rawInput = String(studentName || '').trim()
  const target = normalizeName(rawInput)
  if (!target) return []

  const byId = new Map<string, StudentCandidate>()

  // 1) First try an exact Firestore equality match (fast path).
  // Note: Firestore string equality is case-sensitive.
  // This will work if the user types the name exactly as stored in progressReports.studentName.
  try {
    const exactQ = query(
      collection(db, 'progressReports'),
      where('studentName', '==', rawInput),
      limit(25),
    )
    const exactSnap = await getDocs(exactQ)
    exactSnap.docs.forEach((d) => {
      const data = d.data() as any
      const sid = typeof data?.studentId === 'string' ? data.studentId.trim() : ''
      const sname = typeof data?.studentName === 'string' ? data.studentName.trim() : ''
      if (!sid || !sname) return
      if (byId.has(sid)) return
      byId.set(sid, {
        studentId: sid,
        studentName: sname,
        className: typeof data?.className === 'string' ? data.className : undefined,
      })
    })
  } catch {
    // ignore; we'll fallback to a broader scan
  }

  if (byId.size > 0) return Array.from(byId.values())

  // 2) Fallback: scan most-recent reports and compare using normalized matching
  // (handles case/whitespace differences).
  const scanQ = query(collection(db, 'progressReports'), orderBy('updatedAtIso', 'desc'), limit(maxScan))
  const scanSnap = await getDocs(scanQ)

  scanSnap.docs.forEach((d) => {
    const data = d.data() as any
    const sid = typeof data?.studentId === 'string' ? data.studentId.trim() : ''
    const sname = typeof data?.studentName === 'string' ? data.studentName.trim() : ''
    if (!sid || !sname) return
    if (normalizeName(sname) !== target) return
    if (byId.has(sid)) return
    byId.set(sid, {
      studentId: sid,
      studentName: sname,
      className: typeof data?.className === 'string' ? data.className : undefined,
    })
  })

  return Array.from(byId.values())
}

export const linkStudentToParentProfile = async (uid: string, studentId: string) => {
  const sid = String(studentId || '').trim()
  const parentUid = String(uid || '').trim()
  if (!parentUid || !sid) return

  const existing = await getParentProfile(parentUid)
  const current = Array.isArray(existing?.studentIds) ? existing!.studentIds : []
  const next = Array.from(new Set([...current, sid])).filter((x) => String(x || '').trim())

  const toSave: ParentProfile = {
    uid: parentUid,
    studentIds: next,
    createdAtIso: existing?.createdAtIso || new Date().toISOString(),
  }

  await setDoc(doc(db, 'parentProfiles', parentUid), toSave, { merge: true })
}

export type ProgressReportDoc = {
  id: string
  owner: string
  studentId: string
  studentName: string
  className: string
  academicYear: string
  term: string
  schoolName: string
  teacherName: string
  teacherComment?: string
  subjects: string[]
  results: Array<{ subject: string; percentage: number; grade: string }>
  useClassPosition: boolean
  parentCopy: boolean
  logoBase64?: string
  schoolStamp?: string
  updatedAtIso: string
}

export const getLatestProgressReportForStudent = async (studentId: string): Promise<ProgressReportDoc | null> => {
  const sid = String(studentId || '').trim()
  if (!sid) return null

  const q = query(
    collection(db, 'progressReports'),
    where('studentId', '==', sid),
    orderBy('updatedAtIso', 'desc'),
    limit(1),
  )
  const snap = await getDocs(q)
  const first = snap.docs[0]
  if (!first) return null
  return { id: first.id, ...(first.data() as any) } as ProgressReportDoc
}

export const subscribeLatestProgressReportForStudent = (
  studentId: string,
  cb: (doc: ProgressReportDoc | null) => void,
): Unsubscribe => {
  const sid = String(studentId || '').trim()
  if (!sid) {
    cb(null)
    return () => {}
  }

  const q = query(
    collection(db, 'progressReports'),
    where('studentId', '==', sid),
    orderBy('updatedAtIso', 'desc'),
    limit(1),
  )

  return onSnapshot(
    q,
    (snap) => {
      const first = snap.docs[0]
      if (!first) {
        cb(null)
        return
      }
      cb({ id: first.id, ...(first.data() as any) } as ProgressReportDoc)
    },
    () => cb(null),
  )
}

// Ultra-aggressive cache clearing for emergency situations (factory resets, etc.)
export async function clearAllFirebaseCache(): Promise<void> {
  try {
    console.log('🚨 ULTRA-AGGRESSIVE cache clearing (emergency mode)...')
    
    // Step 1: Disable network
    await disableNetwork(db)
    
    // Step 2: Clear IndexedDB persistence cache
    await clearIndexedDbPersistence(db)
    
    // Step 3: Clear browser storage
    if (typeof window !== 'undefined') {
      Object.keys(localStorage).forEach(key => {
        if (key.includes('firebase') || key.includes('firestore')) {
          localStorage.removeItem(key)
        }
      })
      
      Object.keys(sessionStorage).forEach(key => {
        if (key.includes('firebase') || key.includes('firestore')) {
          sessionStorage.removeItem(key)
        }
      })
    }
    
    // Step 4: Re-enable network
    await enableNetwork(db)
    
    // Step 5: Wait for fresh connection
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    console.log('✅ Ultra-aggressive cache clearing completed')
  } catch (error) {
    console.error('❌ Error during ultra-aggressive cache clearing:', error)
  }
}

// Get initial data from a Firestore collection with optional cache clearing
export async function getInitial<T>(collectionName: string, forceFresh = false): Promise<T[]> {
  try {
    // Gentle cache clearing for routine refreshes, aggressive only when needed
    if (forceFresh) {
      console.log(`🔄 Gentle cache refresh for ${collectionName}...`)
      
      try {
        // Only use network disable/enable for gentle refresh (no IndexedDB clearing)
        await disableNetwork(db)
        await enableNetwork(db)
        
        // Short delay for gentle refresh (reduced from 1000ms to 200ms)
        await new Promise(resolve => setTimeout(resolve, 200))
      } catch (cacheError: any) {
        console.log(`⚠️ Gentle cache refresh completed for ${collectionName}:`, cacheError?.message || 'Unknown error')
      }
    }
    
    const collectionRef = collection(db, collectionName)
    const querySnapshot = await getDocs(collectionRef)
    
    const data: T[] = []
    querySnapshot.forEach((doc) => {
      data.push({ id: doc.id, ...doc.data() } as T)
    })
    
    console.log(`📊 Fetched ${data.length} items from ${collectionName}${forceFresh ? ' (refreshed)' : ''}`)
    
    return data
  } catch (error) {
    console.error(`❌ Error fetching ${collectionName}:`, error)
    return []
  }
}

// Subscribe to real-time updates from a Firestore collection
export function subscribe<T>(collectionName: string, cb: (docs: T[]) => void) {
  try {
    const collectionRef = collection(db, collectionName)
    
    // Subscribe to real-time updates
    const unsubscribe = onSnapshot(collectionRef, (querySnapshot) => {
      const data: T[] = []
      querySnapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() } as T)
      })
      cb(data)
    }, (error) => {
      console.error(`Error subscribing to ${collectionName}:`, error)
      cb([]) // Return empty array on error
    })
    
    return unsubscribe
  } catch (error) {
    console.error(`Error setting up subscription for ${collectionName}:`, error)
    return () => {} // Return empty unsubscribe function
  }
}

// Get a single document from Firestore
export async function getOne<T>(collectionName: string, id: string): Promise<T | null> {
  try {
    const docRef = doc(db, collectionName, id)
    const docSnap = await getDocs(query(collection(db, collectionName)))
    
    // Find the document with matching id
    let foundDoc: T | null = null
    docSnap.forEach((document) => {
      const data = document.data()
      if (data.id === id || document.id === id) {
        foundDoc = { id: document.id, ...data } as T
      }
    })
    
    return foundDoc
  } catch (error) {
    console.error(`Error fetching document ${id} from ${collectionName}:`, error)
    return null
  }
}

// Subscribe to a single document's updates
export function subscribeOne<T>(collectionName: string, id: string, cb: (doc: T | null) => void) {
  try {
    const collectionRef = collection(db, collectionName)
    
    const unsubscribe = onSnapshot(collectionRef, (querySnapshot) => {
      let foundDoc: T | null = null
      querySnapshot.forEach((doc) => {
        const data = doc.data()
        if (data.id === id || doc.id === id) {
          foundDoc = { id: doc.id, ...data } as T
        }
      })
      cb(foundDoc)
    }, (error) => {
      console.error(`Error subscribing to document ${id} in ${collectionName}:`, error)
      cb(null)
    })
    
    return unsubscribe
  } catch (error) {
    console.error(`Error setting up subscription for document ${id} in ${collectionName}:`, error)
    return () => {}
  }
}
