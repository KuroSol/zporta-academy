// src/pages/register/community.js
import ModernFeatureSignup from "@/components/ModernFeatureSignup";

export default function CommunitySignupPage() {
  return (
    <ModernFeatureSignup
      pageKey="community"
      seoTitle="Developer Community | Zporta Academy"
      seoDesc="Join a vibrant community of learners. Share projects, ask questions, and network."
      dataEndpoint="/posts/?limit=6"
      dataType="posts"
    />
  );
}
