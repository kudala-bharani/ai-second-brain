'use client'

import { useId, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, Loader2, LogOut, User } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface HeaderProps {
  userEmail: string
  onLogout?: () => Promise<void> | void
}

export default function Header({ userEmail, onLogout }: HeaderProps) {
  const router = useRouter()
  const supabase = createClient()
  const menuId = useId()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [loggingOut, setLoggingOut] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const displayName = userEmail.split('@')[0]
  const avatarInitial = displayName.charAt(0).toUpperCase()

  async function handleLogout() {
    setLoggingOut(true)
    try {
      if (onLogout) {
        await onLogout()
      } else {
        await supabase.auth.signOut()
        router.push('/')
        router.refresh()
      }
    } finally {
      setLoggingOut(false)
    }
  }

  return (
    <header className="workspace-header">
      <div className="workspace-width workspace-header-inner">
        <span className="wordmark">
          <span className="brand-mark" aria-hidden="true" />
          AI Second Brain
        </span>

        <div
          className="workspace-account"
          onKeyDown={(event) => {
            if (event.key === 'Escape' && menuOpen) {
              setMenuOpen(false)
              triggerRef.current?.focus()
            }
          }}
        >
          <button
            ref={triggerRef}
            type="button"
            className="btn-ghost account-trigger"
            aria-label={displayName ? `Account for ${displayName}` : 'Account'}
            aria-controls={menuId}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span className="account-initial" aria-hidden="true">
              {avatarInitial || <User size={15} />}
            </span>
            {displayName && <span className="account-name">{displayName}</span>}
            <ChevronDown size={15} aria-hidden="true" />
          </button>

          {menuOpen && <div className="account-backdrop" onClick={() => setMenuOpen(false)} aria-hidden="true" />}

          <div className="account-panel" id={menuId} hidden={!menuOpen}>
            {userEmail && <p className="account-email">{userEmail}</p>}
            <button className="btn-ghost" type="button" onClick={handleLogout} disabled={loggingOut}>
              {loggingOut ? (
                <Loader2 size={16} className="status-spinner" aria-hidden="true" />
              ) : (
                <LogOut size={16} aria-hidden="true" />
              )}
              {loggingOut ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}
