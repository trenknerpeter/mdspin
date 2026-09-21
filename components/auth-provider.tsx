"use client"

import { createContext, useContext, useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { identify, resetIdentity } from "@/lib/analytics/client"
import type { User } from "@supabase/supabase-js"

type AuthContext = {
  user: User | null
  isLoading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContext>({
  user: null,
  isLoading: true,
  signOut: async () => {},
})

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
      setIsLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setIsLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Analytics identity is re-asserted here rather than only at sign-in.
  // PostHog runs cookieless (see instrumentation-client.ts), so its distinct id
  // resets on every full page load; without this a single person would show up
  // as a new anonymous user on each navigation. It also covers the two cases
  // sign-in-page identification always missed: Google OAuth, which returns via
  // a redirect, and users arriving with a session already in place.
  useEffect(() => {
    if (user) identify(user.id, user.email)
  }, [user?.id, user?.email])

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    // Without this the next visitor on this browser inherits the distinct id
    // and is merged into the person who just left.
    resetIdentity()
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}
