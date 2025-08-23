'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import Footer from '../dashboard/models/footer';
import LoadingPopup from '../components/loading';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await signIn('credentials', {
      redirect: false,
      email,
      password,
    });

    setLoading(false);

    if (result?.error) {
      setError(result.error);
    } else {
      router.push('/dashboard');
    }
  };

  return (
    <div className="h-screen flex flex-col">
      {loading && <LoadingPopup />}
      <main className="h-full flex items-center justify-center bg-gray-50">
        <div className="w-full max-w-sm p-6 bg-white border border-gray-200">
          <h1 className="text-2xl font-bold mb-6 text-center">Login to GRIT</h1>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-700 font-medium mb-1">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm border border-gray-600 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-700 font-medium mb-1">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm border border-gray-600 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>

            <p className="text-sm text-gray-600">
              Forgot your password?{' '}
              <a
                href="/forgot-password"
                className="text-blue-600 hover:underline"
              >
                Reset it here
              </a>
            </p>

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <button
              type="submit"
              className="w-full bg-blue-500 text-sm text-white px-4 py-2 hover:bg-blue-600 transition"
            >
              Log In
            </button>
          </form>
        </div>
      </main>
      <Footer />
    </div>
  );
}
