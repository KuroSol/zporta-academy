// src/pages/register/explore.js
import ModernFeatureSignup from "@/components/ModernFeatureSignup";

export default function ExploreSignupPage() {
  return (
    <ModernFeatureSignup
      pageKey="explore"
      seoTitle="Explore Courses & Paths | Zporta Academy"
      seoDesc="Browse our extensive library of coding courses, design tutorials, and language paths."
      dataEndpoint="/courses/?random=6"
      dataType="courses"
    />
  );
}
