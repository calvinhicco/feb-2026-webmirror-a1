import './globals.css'
import { TooltipProvider } from '@/components/ui/tooltip'
import Nav from '@/components/Nav'

export const metadata = {
  title: 'My Students - School Real-Time update 2026',
  description: 'School Real-Time update 2026 — synced from the desktop app. Editing is disabled.',
}

export default function RootLayout({ children }: { children: any }) {
  return (
    <html lang="en">
      <body className="font-sans">
        <TooltipProvider>
          <div className="w-full bg-yellow-50 border-b border-yellow-200 text-yellow-900 text-sm py-2 text-center">
            School Real-Time update 2026 — synced from the desktop app. Editing is disabled.
          </div>
          <Nav />
          <main className="min-h-screen">
            {children}
          </main>
        </TooltipProvider>
      </body>
    </html>
  )
}
