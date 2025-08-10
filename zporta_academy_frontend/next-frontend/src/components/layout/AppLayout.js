// src/components/layout/AppLayout.js
import { useState } from 'react';
import AppHeader from '../AppHeader/AppHeader';
import SidebarMenu from '../SidebarMenu';

export default function AppLayout({ children, enabled = true }) {
  if (!enabled) return <>{children}</>;

  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <>
      <AppHeader />
      <SidebarMenu isExpanded={isExpanded} setIsExpanded={setIsExpanded} />
      {/* keep content below the fixed header */}
      <main style={{ paddingTop: '55px' }}>
        {children}
      </main>
    </>
  );
}
