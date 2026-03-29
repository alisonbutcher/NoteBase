'use client';

import { Sidebar } from './sidebar';

interface AppLayoutProps {
  children: React.ReactNode;
  currentDate?: string;
}

export function AppLayout({ children, currentDate }: AppLayoutProps) {
  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg)' }}>
      <Sidebar currentDate={currentDate} />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
