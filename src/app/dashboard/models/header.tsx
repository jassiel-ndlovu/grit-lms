'use client'

import { Bell, ChevronDown, LogOut, User } from 'lucide-react'
import Image from 'next/image'
import { useState, useRef, useEffect } from 'react'

type HeaderProps = {
  user: {
    name: string
    surname: string
    avatarUrl?: string
  }
}

export default function Header({ user }: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <header className="w-full flex items-center justify-between bg-gray-100 border-b border-b-gray-300 pt-3 pb-2 px-4">

      {/* App Name or Breadcrumb */}
      <div className="text-lg font-semibold text-gray-800">Dashboard</div>

      {/* Right Section */}
      <div className="flex items-center gap-4 relative">
        {/* Notifications */}
        <button className="relative p-2 rounded-full hover:bg-gray-100">
          <Bell className="w-4.5 h-4.5 text-gray-600" />
          {/* Optional notification badge */}
          <span className="absolute top-0 right-0.5 bg-red-500 text-white text-[10px] rounded-full px-1.5">
            2
          </span>
        </button>

        {/* User Profile */}
        <div ref={menuRef} className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center space-x-2 px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-100 transition"
          >
            {user.avatarUrl === "/avatar-default.png" ? (
              <div className="relative w-8 h-8 rounded-full overflow-hidden">
                <Image
                  src={user.avatarUrl || ''}
                  alt="Profile"
                  className="w-7 h-7 rounded-full object-cover"
                  fill
                />
              </div>
            ) : (
              <div className="w-7 h-7 bg-orange-500 text-sm font-semibold rounded-full flex items-center justify-center text-white">
                {user.name.charAt(0).toUpperCase()}
              </div>
            )}

            <span className="text-sm font-medium text-gray-800 hidden sm:block">
              {user.name} {user.surname}
            </span>
            <ChevronDown className="w-4 h-4 text-gray-500" />
          </button>

          {/* Dropdown Dialog */}
          {menuOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 shadow-lg rounded-md z-50">
              <ul className="py-2 text-sm text-gray-700">
                <li className="px-4 py-2 hover:bg-gray-100 flex items-center gap-2 cursor-pointer">
                  <User className="w-4 h-4" />
                  View Profile
                </li>
                <li className="px-4 py-2 hover:bg-gray-100 flex items-center gap-2 cursor-pointer">
                  <LogOut className="w-4 h-4" />
                  Log Out
                </li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
