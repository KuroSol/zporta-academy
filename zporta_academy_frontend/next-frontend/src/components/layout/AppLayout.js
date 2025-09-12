// src/components/layout/AppLayout.js
import { useEffect, useRef, useState } from "react";
import AppHeader from '@/components/AppHeader/AppHeader';
import SidebarMenu from '@/components/SidebarMenu';



export default function AppLayout({ children, enabled = true }) {
  if (!enabled) return <>{children}</>;

  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <>
      <AppHeader />
      <SidebarMenu isExpanded={isExpanded} setIsExpanded={setIsExpanded} />
      <main className="app-shell" style={{ paddingTop: '50px' }}>{children}</main>
      
    </>
  );
}
