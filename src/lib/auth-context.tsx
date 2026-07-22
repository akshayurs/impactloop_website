'use client'
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut as fbSignOut,
  type User,
} from 'firebase/auth'
import { createContext, useContext, useEffect, useState } from 'react'
import { getFirebaseAuth } from './firebase/client'
import { MOCK_ROLE, mockUser } from './mock'

type AuthState = {
  user: User | null
  loading: boolean
  signIn: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Start unresolved on both server and first client render so SSR HTML matches
  // hydration; the mock user or real auth state is applied after mount.
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (MOCK_ROLE) {
      setUser(mockUser)
      setLoading(false)
      return
    }
    return onAuthStateChanged(getFirebaseAuth(), (u) => {
      setUser(u)
      setLoading(false)
    })
  }, [])

  const signIn = async () => {
    await signInWithPopup(getFirebaseAuth(), new GoogleAuthProvider())
  }
  const signOut = async () => {
    await fbSignOut(getFirebaseAuth())
  }

  return <AuthContext.Provider value={{ user, loading, signIn, signOut }}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth outside AuthProvider')
  return ctx
}
