import { useEffect, useState } from 'react'
import type { User } from '@supabase/auth-js'
import { supabase } from '../utils/supabase'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null)
        setLoading(false)
      }
    )

    return () => {
      subscription?.unsubscribe()
    }
  }, [])

  const signUp = async (email: string, password: string) => {
    try {
      setError(null)
      const { error } = await supabase.auth.signUp({
        email,
        password,
      })
      if (error) throw error
      return { success: true }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao criar conta'
      setError(message)
      return { success: false, error: message }
    }
  }

  const signIn = async (email: string, password: string) => {
    try {
      setError(null)
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) throw error
      return { success: true }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao fazer login'
      setError(message)
      return { success: false, error: message }
    }
  }

  const signOut = async () => {
    try {
      setError(null)
      await supabase.auth.signOut()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao fazer logout'
      setError(message)
    }
  }

  return {
    user,
    loading,
    error,
    signUp,
    signIn,
    signOut,
    isAuthenticated: !!user,
  }
}
