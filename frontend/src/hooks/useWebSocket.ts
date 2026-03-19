'use client'

import { useEffect, useRef, useCallback } from 'react'
import { getAddress } from '@/lib/auth'

export function useWebSocket(onMessage: (data: unknown) => void) {
  const wsRef = useRef<WebSocket | null>(null)
  const onMessageRef = useRef(onMessage)
  onMessageRef.current = onMessage

  useEffect(() => {
    const address = getAddress()
    if (!address) return

    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000/api'
    const wsUrl = backendUrl
      .replace(/^https/, 'wss')
      .replace(/^http/, 'ws')
      .replace(/\/api$/, '/ws')

    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'subscribe', address }))
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        onMessageRef.current(data)
      } catch {
        // ignore malformed frames
      }
    }

    ws.onerror = () => {
      // silently ignore — WS is optional real-time enhancement
    }

    return () => {
      ws.close()
    }
  }, [])

  const send = useCallback((data: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data))
    }
  }, [])

  return { send }
}
