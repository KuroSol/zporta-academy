// src/components/layout/AppLayout.js
import { useEffect, useRef, useState } from "react";
import AppHeader from "@/components/AppHeader/AppHeader";
import SidebarMenu from "@/components/SidebarMenu";
import Footer from "@/components/layout/Footer";

export default function AppLayout({ children, enabled = true }) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!enabled) return <>{children}</>;

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <AppHeader />
      <SidebarMenu isExpanded={isExpanded} setIsExpanded={setIsExpanded} />
      <main
        className="app-shell"
        style={{ paddingTop: "50px", flex: 1, width: "100%" }}
      >
        {children}
      </main>
      <Footer />
    </div>
  );
}
