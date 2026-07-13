import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app'
import { getAuth, type Auth } from 'firebase/auth'
import { getFirestore, type Firestore } from 'firebase/firestore'

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

// Firebase init throws synchronously on a missing/invalid API key, which would break
// `next build`'s server-side prerender of client components (no real env vars at build
// time). Guard so init only ever runs in the browser, where real env vars are present.
const isBrowser = typeof window !== 'undefined'

export const firebaseApp = (isBrowser ? (getApps().length ? getApp() : initializeApp(config)) : undefined) as FirebaseApp
export const auth = (isBrowser ? getAuth(firebaseApp) : undefined) as Auth
export const db = (isBrowser ? getFirestore(firebaseApp) : undefined) as Firestore
