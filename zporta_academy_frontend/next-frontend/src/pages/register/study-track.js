// src/pages/register/study-track.js
import ModernFeatureSignup from "@/components/ModernFeatureSignup";

export default function StudyTrackSignupPage() {
  return (
    <ModernFeatureSignup
      pageKey="studyTrack"
      seoTitle="Study Tracker & Analytics | Zporta Academy"
      seoDesc="Advanced learning analytics to track your study habits, streaks, and completion rates."
      dataEndpoint="/lessons/?ordering=-created_at&limit=6"
      dataType="lessons"
    />
  );
}
