// src/pages/guide/[username].js
import PublicGuideProfile from "@/components/PublicGuideProfile";

// SSR enabled - component has window checks and Head tags for proper SEO
export default function GuideProfilePage() {
  return <PublicGuideProfile />;
}
