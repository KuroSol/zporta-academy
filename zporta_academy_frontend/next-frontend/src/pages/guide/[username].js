// src/pages/guides/[username].js
import dynamic from "next/dynamic";

const PublicGuideProfile = dynamic(
  () => import("@/components/PublicGuideProfile").then(m => m.default || m),
  { ssr: false }
);

export default function GuideProfilePage() {
  return <PublicGuideProfile />;
}
