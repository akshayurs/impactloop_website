import { getApps, initializeApp, type FirebaseApp } from 'firebase/app'
import { getAuth, type Auth } from 'firebase/auth'

function app(): FirebaseApp {
  if (typeof window === 'undefined') throw new Error('firebase client used on server')
  const existing = getApps()[0]
  if (existing) return existing
  return initializeApp({
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  })
}

export function getFirebaseAuth(): Auth {
  return getAuth(app())
}
