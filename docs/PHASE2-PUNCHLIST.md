# Phase 2 punch list (carried over from phase-1 review)

- [ ] Refactor `src/lib/firebase.ts`: it exports `auth`/`db`/`firebaseApp` cast `as Auth/Firestore/FirebaseApp` while actually `undefined` server-side (safe in phase 1 — only client consumer). Before phase-2 Firestore/server route handlers, use `firebase-admin` server-side and stop exporting client `db`/`auth` with casts that hide `undefined` (or make server access throw).

- [ ] `src/app/layout.tsx` `metadataBase` points at `https://impactloopapps.github.io` — flip to the real deployment domain at cutover (OG/canonical URLs).

- [ ] `src/components/AuthButton.tsx` returns `null` while auth is loading — consider a skeleton/disabled state.

- [ ] Next.js version pin is load-bearing: the `next/dynamic` `{ssr:false}`-inside-a-Server-Component pattern (used by `/` and `/account`) is allowed in Next 14 but errors in Next 15. Do not bump to 15 without migrating that pattern.

- [ ] Manual gates (need real Firebase creds / a browser): fill `.env.local` with real `NEXT_PUBLIC_FIREBASE_*`, add localhost + Vercel preview domain to Firebase Auth authorized domains, then verify Google sign-in + signed-out `/account` redirect, and do a real-browser pass of the 3D marketing page (hero/particles render, Lenis scroll, reduced-motion off, console clean).
