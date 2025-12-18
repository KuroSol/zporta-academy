// src/pages/register/progress.js
import ModernFeatureSignup from "@/components/ModernFeatureSignup";

export default function ProgressSignupPage() {
  return (
    <ModernFeatureSignup
      pageKey="progress"
      seoTitle="Learning Progress Dashboard | Zporta Academy"
      seoDesc="Track your learning velocity and retention with our advanced progress dashboard."
      dataEndpoint="/lessons/?ordering=-created_at&limit=6"
      dataType="lessons"
    />
  );
}
