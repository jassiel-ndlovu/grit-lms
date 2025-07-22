'use client'

import LoadingPopup from '@/app/components/loading'
import { ProfileProvider, useProfile } from '@/context/ProfileContext'
import { Bell, ChevronDown, ChevronUp, LogOut, User } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useState, useRef, useEffect } from 'react'

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

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
      <div className="text-lg font-semibold text-gray-800">Dashboard</div>

      <div className="flex items-center gap-4 relative">
        <button className="relative p-2 rounded-full hover:bg-gray-100">
          <Bell className="w-4.5 h-4.5 text-gray-600" />
          <span className="absolute top-0 right-0.5 bg-red-500 text-white text-[10px] rounded-full px-1.5">2</span>
        </button>

        <div ref={menuRef} className="relative">
          <ProfileProvider>
            <HeaderUserProfile menuOpen={menuOpen} setMenuOpen={setMenuOpen} />
          </ProfileProvider>

          {menuOpen && (
            <div className="absolute right-0 w-60 bg-white border border-gray-200 shadow-lg rounded-md z-50">
              <ul className="py-2 text-sm text-gray-700">
                <li className="px-4 py-2 hover:bg-gray-100">
                  <Link 
                    href="/dashboard/account"
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <User className="w-4 h-4" />
                    View Profile
                  </Link>
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
  );
}

type HeaderUserProfileProps = {
  menuOpen: boolean
  setMenuOpen: React.Dispatch<React.SetStateAction<boolean>>
}

function HeaderUserProfile({ menuOpen, setMenuOpen }: HeaderUserProfileProps) {
  const { profile, status } = useProfile();

  if (status === 'loading') return <LoadingPopup />;
  if (!profile) {
    console.log("Profile not found");
    return null;
  }

  let imageUrl: string | null = null;

  if ('imageUrl' in profile && typeof profile.imageUrl === 'string') {
    imageUrl = profile.imageUrl;
  } else if ('profileImageUrl' in profile && typeof profile.profileImageUrl === 'string') {
    imageUrl = profile.profileImageUrl;
  }

  return (
    <button
      onClick={() => setMenuOpen(!menuOpen)}
      className="w-60 flex items-center space-x-2 px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-100 transition"
    >
      {imageUrl ? (
        <div className="relative w-8 h-8 rounded-full overflow-hidden">
          <Image src={imageUrl} alt="Profile" className="object-cover" fill />
        </div>
      ) : (
        <div className="w-7 h-7 bg-orange-500 text-sm font-semibold rounded-full flex items-center justify-center text-white">
          {profile.fullName?.charAt(0).toUpperCase() ?? 'U'}
        </div>
      )}
      <span className="w-36 overflow-hidden text-nowrap text-ellipsis text-sm font-medium text-gray-800 hidden sm:block">
        {profile.fullName}
      </span>
      {menuOpen ?
        <ChevronUp
          className="w-4 h-4 text-gray-500"
        /> :
        <ChevronDown
          className="w-4 h-4 text-gray-500"
        />
      }
    </button>
  );
}
