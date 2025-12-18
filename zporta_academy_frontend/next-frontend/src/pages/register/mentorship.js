// src/pages/register/mentorship.js
import ModernFeatureSignup from "@/components/ModernFeatureSignup";

export default function MentorshipSignupPage() {
  return (
    <ModernFeatureSignup
      pageKey="mentorship"
      seoTitle="Mentorship Program | Zporta Academy"
      seoDesc="Connect with experienced developers and designers for personalized career guidance."
      dataEndpoint="/users/guides/?limit=6"
      dataType="guides"
    />
  );
}
