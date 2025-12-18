// src/pages/register/compare-skills.js
import ModernFeatureSignup from "@/components/ModernFeatureSignup";

export default function CompareSkillsSignupPage() {
  return (
    <ModernFeatureSignup
      pageKey="compareSkills"
      seoTitle="Skill Assessment & Benchmarking | Zporta Academy"
      seoDesc="Test your coding skills with adaptive quizzes and compare your results with global averages."
      dataEndpoint="/quizzes/?limit=6"
      dataType="quizzes"
    />
  );
}
