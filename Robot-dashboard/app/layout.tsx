import type React from "react"
import type { Metadata } from "next"
import "./globals.css"
import { Suspense } from "react"

import { Plus_Jakarta_Sans, IBM_Plex_Mono, Plus_Jakarta_Sans as V0_Font_Plus_Jakarta_Sans, IBM_Plex_Mono as V0_Font_IBM_Plex_Mono, Lora as V0_Font_Lora } from 'next/font/google'

// Initialize fonts
const _plusJakartaSans = V0_Font_Plus_Jakarta_Sans({ subsets: ['latin'], weight: ["200","300","400","500","600","700","800"] })
const _ibmPlexMono = V0_Font_IBM_Plex_Mono({ subsets: ['latin'], weight: ["100","200","300","400","500","600","700"] })
const _lora = V0_Font_Lora({ subsets: ['latin'], weight: ["400","500","600","700"] })

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["200", "300", "400", "500", "600", "700", "800"],
  variable: "--font-plus-jakarta-sans",
})

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["100", "200", "300", "400", "500", "600", "700"],
  variable: "--font-ibm-plex-mono",
})

export const metadata: Metadata = {
  title: "ROS2 Dashboard",
  description: "Real-time ROS2 data visualization dashboard",
  generator: "v0.app",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`${plusJakartaSans.variable} ${ibmPlexMono.variable} font-sans antialiased`}>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Suppress browser extension async message warnings
              window.addEventListener('error', function(e) {
                if (e.message && e.message.includes('message channel closed before a response was received')) {
                  e.preventDefault();
                  return true;
                }
              });
              
              window.addEventListener('unhandledrejection', function(e) {
                if (e.reason && e.reason.message && e.reason.message.includes('message channel closed before a response was received')) {
                  e.preventDefault();
                  return true;
                }
              });
            `
          }}
        />
        <Suspense fallback={<div>Loading...</div>}>{children}</Suspense>
      </body>
    </html>
  )
}
