"use client"

import { useEffect, useRef } from "react"

interface QRCodeCanvasProps {
  value: string
  size?: number
}

/**
 * Lightweight QR code component using a Google Charts API fallback.
 * For production, install `qrcode` package and render client-side canvas.
 * This uses an img tag with a QR code API as a zero-dependency solution.
 */
export function QRCodeCanvas({ value, size = 64 }: QRCodeCanvasProps) {
  // Use Google Charts QR Code API — simple, reliable, no dependency
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size * 2}x${size * 2}&data=${encodeURIComponent(value)}&format=svg`

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={qrUrl}
      alt="QR Code de verificacao"
      width={size}
      height={size}
      className="rounded"
      style={{ imageRendering: "pixelated" }}
    />
  )
}
