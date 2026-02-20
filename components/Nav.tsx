"use client"

import Link from 'next/link'
import { useState } from 'react'

const items = [
  { href: '/', label: 'Dashboard', icon: '🏠' },
  { href: '/students', label: 'Students', icon: '👥' },
  { href: '/inventory', label: 'Inventory', icon: '📦' },
  { href: '/expenses', label: 'Expenses', icon: '🧾' },
  { href: '/extrabilling', label: 'Extra Billing', icon: '📄' },
  { href: '/outstanding', label: 'Outstanding', icon: '⚠️' },
  { href: '/progress-report', label: 'Progress Report', icon: '📊' },
]

export default function Nav() {
  const [isOpen, setIsOpen] = useState(false)
  
  return (
    <nav className="border-b bg-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        {/* Desktop Navigation */}
        <div className="hidden md:flex h-14 items-center gap-6">
          {items.map((item) => (
            <Link 
              key={item.href} 
              href={item.href as string} 
              className="flex items-center gap-2 text-sm transition-colors hover:text-primary py-2 px-3 rounded-md text-muted-foreground hover:bg-accent/50"
            >
              <span className="text-lg">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </div>

        {/* Mobile Navigation */}
        <div className="md:hidden">
          <div className="flex h-14 items-center justify-between">
            <h1 className="text-lg font-semibold">My Students Track</h1>
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="p-2 rounded-md hover:bg-accent/50 text-2xl"
            >
              {isOpen ? '✕' : '☰'}
            </button>
          </div>
          
          {/* Mobile Menu */}
          {isOpen && (
            <div className="border-t bg-white">
              <div className="py-2 space-y-1">
                {items.map((item) => (
                  <Link 
                    key={item.href} 
                    href={item.href as string}
                    onClick={() => setIsOpen(false)}
                    className="flex items-center gap-3 text-sm py-3 px-4 transition-colors text-muted-foreground hover:bg-accent/50"
                  >
                    <span className="text-xl">{item.icon}</span>
                    <span>{item.label}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}
