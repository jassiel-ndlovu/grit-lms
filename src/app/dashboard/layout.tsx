"use client"

import { ReactNode } from 'react';
import Footer from '../components/footer'
import Header from './models/header';
import Nav from './models/nav';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const user = {
    name: 'Jassiel',
    surname: 'Ndlovu',
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Layout Container */}
      <div className="flex flex-1">
        {/* Sidebar */}
        <Nav />

        {/* Main Content */}
        <main className="h-[100vh] flex-1 flex flex-col">
          <Header user={user} />
          <div className="h-[92vh]">
            {children}
          </div>
        </main>
      </div>

      {/* Footer */}
      <Footer />
    </div>
  );
}