"use client"

import { useCallback, useEffect, useRef, useState } from "react"

interface UseSSEOptions {
  onMessage: (data: Record<string, unknown>) => void
  onComplete?: () => void
  onError?: () => void
  maxRetries?: number
}

export function useSSE(url: string | null, options: UseSSEOptions) {
  const { onMessage, onComplete, onError, maxRetries = 5 } = options
  const [isConnected, setIsConnected] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  const eventSourceRef = useRef<EventSource | null>(null)
  const retriesRef = useRef(0)

  const connect = useCallback(() => {
    if (!url) return

    const es = new EventSource(url)
    eventSourceRef.current = es

    es.onopen = () => {
      setIsConnected(true)
      retriesRef.current = 0
      setRetryCount(0)
    }

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        onMessage(data)

        if (["review", "completed", "failed", "timeout"].includes(data.status)) {
          es.close()
          setIsConnected(false)
          onComplete?.()
        }
      } catch {
        // Ignore parse errors
      }
    }

    es.onerror = () => {
      es.close()
      setIsConnected(false)

      if (retriesRef.current < maxRetries) {
        retriesRef.current++
        setRetryCount(retriesRef.current)
        setTimeout(() => {
          connect()
        }, 3000)
      } else {
        onError?.()
      }
    }
  }, [url, onMessage, onComplete, onError, maxRetries])

  useEffect(() => {
    connect()
    return () => {
      eventSourceRef.current?.close()
    }
  }, [connect])

  return { isConnected, retryCount, maxRetries }
}
