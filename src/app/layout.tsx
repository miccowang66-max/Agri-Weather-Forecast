import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '台灣天氣觀測地圖',
  description: '即時氣象觀測數據視覺化',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-TW">
      <body>{children}</body>
    </html>
  )
}
