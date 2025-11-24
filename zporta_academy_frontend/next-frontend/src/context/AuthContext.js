// next-frontend/src/context/AuthContext.js
import React, { createContext, useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/router'
import apiClient from '../api'

export const AuthContext = createContext()

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null)
  const [user, setUser]   = useState(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  // Only read from localStorage on the client
  useEffect(() => {
    if (typeof window === 'undefined') {
      setLoading(false)
      return
    }
    const t = window.localStorage.getItem('token')
    if (t) {
      setToken(t)
      apiClient.defaults.headers.common['Authorization'] = `Token ${t}`
      // fetch user profile
      apiClient.get('/users/profile/')
        .then(res => setUser(res.data))
        .catch(() => {
          window.localStorage.removeItem('token')
          setToken(null)
        })
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  const login = (userData, authToken) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('token', authToken)
    }
    setToken(authToken)
    setUser(userData)
    apiClient.defaults.headers.common['Authorization'] = `Token ${authToken}`
    router.push('/home')
  }

  const logout = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('token')
    }
    setToken(null); setUser(null)
    delete apiClient.defaults.headers.common['Authorization']
    router.push('/login')
  }, [router])

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {loading ? null : children}
    </AuthContext.Provider>
  )
}
