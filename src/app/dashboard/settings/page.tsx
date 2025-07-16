'use client'

import { Sun, Globe, Trash2, Download, EyeOff, SlidersHorizontal } from 'lucide-react'
import { useState } from 'react'

export default function SettingsPage() {
  const [theme, setTheme] = useState<'system' | 'light' | 'dark'>('system')
  const [fontSize, setFontSize] = useState<'small' | 'medium' | 'large'>('medium')
  const [reducedMotion, setReducedMotion] = useState(false)
  const [timezone, setTimezone] = useState('Africa/Johannesburg')

  return (
    <div className="h-full px-6 py-10 bg-gray-50 overflow-auto">
      <div className="max-w-4xl mx-auto">
        <header className="mb-10">
          <h1 className="text-3xl font-bold text-gray-800">Settings</h1>
          <p className="text-sm text-gray-600 mt-1">Manage your preferences and application behavior.</p>
        </header>

        <div className="bg-white rounded-md  divide-y border border-gray-300">
          {/* General */}
          <section className="p-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
              <Globe className="w-5 h-5 text-gray-500" /> General
            </h2>
            <div className="text-sm text-gray-700">
              <label className="block mb-1 font-medium">Time Zone</label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm"
              >
                <option value="Africa/Johannesburg">Africa/Johannesburg</option>
                <option value="UTC">UTC</option>
                <option value="America/New_York">America/New York</option>
                <option value="Europe/London">Europe/London</option>
              </select>
            </div>
          </section>

          {/* Appearance */}
          <section className="p-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
              <Sun className="w-5 h-5 text-yellow-500" /> Appearance
            </h2>
            <div className="space-y-3 text-sm text-gray-700">
              <div>
                <label className="block font-medium mb-1">Theme</label>
                <div className="flex gap-4">
                  {(['system', 'light', 'dark'] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setTheme(t)}
                      className={`px-4 py-2 rounded border text-sm ${
                        theme === t ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300'
                      }`}
                    >
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Accessibility */}
          <section className="p-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
              <EyeOff className="w-5 h-5 text-indigo-500" /> Accessibility
            </h2>
            <div className="space-y-3 text-sm text-gray-700">
              <div>
                <label className="block font-medium mb-1">Font Size</label>
                <div className="flex gap-3">
                  {(['small', 'medium', 'large'] as const).map((size) => (
                    <button
                      key={size}
                      onClick={() => setFontSize(size)}
                      className={`px-3 py-1 border rounded ${
                        fontSize === size ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-gray-300'
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex justify-between items-center">
                <p>Reduce Motion</p>
                <button
                  onClick={() => setReducedMotion((prev) => !prev)}
                  className={`px-4 py-1 rounded text-xs transition ${
                    reducedMotion ? 'bg-green-500 text-white' : 'bg-gray-300 text-gray-800'
                  }`}
                >
                  {reducedMotion ? 'Enabled' : 'Disabled'}
                </button>
              </div>
            </div>
          </section>

          {/* Privacy & Data */}
          <section className="p-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
              <SlidersHorizontal className="w-5 h-5 text-gray-600" /> Privacy & Data
            </h2>
            <div className="text-sm text-gray-700 space-y-3">
              <button className="flex items-center gap-2 text-blue-600 hover:underline">
                <Download className="w-4 h-4" /> Download my data
              </button>
              <button className="flex items-center gap-2 text-red-600 hover:underline">
                <Trash2 className="w-4 h-4" /> Clear history
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}