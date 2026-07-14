// Usage: node --env-file=.env.local scripts/set-admin.mjs you@example.com
import { cert, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'

const email = process.argv[2]
if (!email) {
  console.error('usage: node --env-file=.env.local scripts/set-admin.mjs <email>')
  process.exit(1)
}
const app = initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) })
const auth = getAuth(app)
const user = await auth.getUserByEmail(email)
await auth.setCustomUserClaims(user.uid, { admin: true })
console.log(`admin claim set for ${email} (${user.uid}) — user must sign out/in to refresh token`)
