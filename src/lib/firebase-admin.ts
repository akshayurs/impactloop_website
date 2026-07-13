import { cert, getApps, getApp, initializeApp, type App } from 'firebase-admin/app'
import { getAuth, type Auth } from 'firebase-admin/auth'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'

// Server-only. Never import this from a client component — pair with `src/lib/firebase.ts`
// (client SDK) for the browser side.
//
// Init is lazy (deferred to first call at request time) so `next build` — which type-checks
// and prerenders the whole tree without real env vars — never triggers it.
let app: App | undefined

export function getAdminApp(): App {
  if (getApps().length) return getApp()
  if (app) return app

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT
  if (!raw) {
    throw new Error(
      'FIREBASE_SERVICE_ACCOUNT is not set. Provide the Firebase service account JSON as an env var to use the Admin SDK.'
    )
  }

  const serviceAccount = JSON.parse(raw)
  app = initializeApp({ credential: cert(serviceAccount) })
  return app
}

export function adminDb(): Firestore {
  return getFirestore(getAdminApp())
}

export function adminAuth(): Auth {
  return getAuth(getAdminApp())
}
