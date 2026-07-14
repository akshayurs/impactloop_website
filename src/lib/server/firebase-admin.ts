import { cert, getApps, initializeApp, type App } from 'firebase-admin/app'
import { getAuth, type Auth } from 'firebase-admin/auth'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'

function app(): App {
  const existing = getApps()[0]
  if (existing) return existing
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT env missing')
  return initializeApp({ credential: cert(JSON.parse(raw)) })
}

export function adminDb(): Firestore {
  return getFirestore(app())
}

export function adminAuth(): Auth {
  return getAuth(app())
}
