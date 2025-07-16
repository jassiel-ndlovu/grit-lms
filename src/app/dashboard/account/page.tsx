'use client'

import { useState } from 'react'
import { Shield, User2, Bell, Lock } from 'lucide-react'

const mockUser = {
  fullName: 'Jane Doe',
  email: 'jane.doe@example.com',
  role: 'Student',
  avatarUrl: '/images/user-avatar.png',
  lastLogin: '2025-07-13T14:32:00Z',
}

export default function AccountPage() {
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)

  return (
    <div className="h-full w-full bg-gray-50 px-6 py-10 overflow-auto">
      <header className="max-w-5xl mx-auto mb-10">
        <h1 className="text-3xl font-bold text-gray-800">Account Settings</h1>
        <p className="text-sm text-gray-600 mt-1">Manage your account details and preferences.</p>
      </header>

      <main className="max-w-5xl mx-auto bg-white rounded-md border border-gray-300 divide-y">
        {/* Profile Summary */}
        <section className="p-6 flex items-center gap-6">
          {/* <Image
            src={mockUser.avatarUrl}
            alt="Profile"
            width={80}
            height={80}
            className="rounded-full border object-cover"
          /> */}
          <div className="w-16 h-16 p-2 text-xl text-white font-medium flex justify-center items-center bg-orange-500 rounded-full">
            {mockUser.fullName.charAt(0)}
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-800">{mockUser.fullName}</h2>
            <p className="text-sm text-gray-500">{mockUser.email}</p>
            <p className="text-sm text-blue-600">{mockUser.role}</p>
          </div>
        </section>

        {/* Account Preferences */}
        <section className="p-6 space-y-4">
          <h3 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
            <User2 className="w-5 h-5 text-gray-500" /> Personal Info
          </h3>
          <div className="text-sm text-gray-600">
            Update your name, email or avatar by contacting support.
          </div>
        </section>

        {/* Notifications */}
        <section className="p-6 space-y-4">
          <h3 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
            <Bell className="w-5 h-5 text-yellow-500" /> Notifications
          </h3>
          <div className="flex items-center justify-between text-sm text-gray-700">
            <p>Email Notifications</p>
            <button
              onClick={() => setNotificationsEnabled(!notificationsEnabled)}
              className={`px-4 py-1 rounded text-white text-xs font-medium transition ${
                notificationsEnabled ? 'bg-green-500 hover:bg-green-600' : 'bg-gray-400 hover:bg-gray-500'
              }`}
            >
              {notificationsEnabled ? 'Enabled' : 'Disabled'}
            </button>
          </div>
        </section>

        {/* Security */}
        <section className="p-6 space-y-4">
          <h3 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
            <Shield className="w-5 h-5 text-indigo-500" /> Security
          </h3>
          <div className="space-y-2 text-sm text-gray-700">
            <p>Last Login: {new Date(mockUser.lastLogin).toLocaleString()}</p>
            <div className="flex justify-between items-center">
              <p>Two-Factor Authentication</p>
              <span className="text-green-600 font-semibold">Enabled</span>
            </div>
            <button className="text-blue-600 hover:underline text-sm">View Device History</button>
          </div>
        </section>

        {/* Password */}
        <section className="p-6 space-y-4">
          <h3 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
            <Lock className="w-5 h-5 text-red-500" /> Password
          </h3>
          <button className="text-blue-600 hover:underline text-sm">Change Password</button>
        </section>

        {/* Danger Zone */}
        <section className="p-6 space-y-4 bg-red-50">
          <h3 className="text-lg font-semibold text-red-700">Danger Zone</h3>
          <div className="text-sm text-red-600">
            Deleting your account is permanent and cannot be undone.
          </div>
          <button className="text-red-700 font-medium border border-red-700 px-4 py-2 rounded hover:bg-red-100 transition">
            Delete My Account
          </button>
        </section>
      </main>
    </div>
  );
}
