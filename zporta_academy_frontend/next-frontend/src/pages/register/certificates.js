// src/pages/register/certificates.js
import ModernFeatureSignup from "@/components/ModernFeatureSignup";

export default function CertificatesSignupPage() {
  return (
    <ModernFeatureSignup
      pageKey="certificates"
      seoTitle="Verified Certificates | Zporta Academy"
      seoDesc="Earn industry-recognized certificates in web development, data science, and design."
      dataEndpoint="/courses/?random=6"
      dataType="courses"
    />
  );
}
