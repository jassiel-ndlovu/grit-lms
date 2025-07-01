'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface InputProps {
  label: string
  type: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  required?: boolean
}

function Input({ label, type, value, onChange, required }: InputProps) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        required={required}
        className="w-full px-3 py-2 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-gritblue"
      />
    </div>
  )
}

interface ButtonProps {
  children: React.ReactNode
  type?: 'button' | 'submit'
  fullWidth?: boolean
}

function Button({ children, type = 'button', fullWidth }: ButtonProps) {
  return (
    <button
      type={type}
      className={`bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition ${
        fullWidth ? 'w-full' : ''
      }`}
    >
      {children}
    </button>
  )
}

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()

    setError('')

    // Replace with your real API call
    if (email === 'test@grit.com' && password === 'password') {
      router.push('/dashboard')
    } else {
      setError('Invalid email or password')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm p-6 bg-white rounded-xl shadow-lg">
        <h1 className="text-2xl font-bold mb-6 text-center text-gritblue">Login to GRIT</h1>

        <form onSubmit={handleLogin} className="space-y-4">
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <Button type="submit" fullWidth>
            Sign In
          </Button>
        </form>
      </div>
    </div>
  )
}
