import dynamic from "next/dynamic";
import Head from "next/head";

// HomePage component loaded client-side only to avoid hydration issues
// BUT Head tags above are SSR'd by Next.js automatically
const HomePage = dynamic(
  () => import("@/components/HomePage").then((m) => m.default || m),
  {
    ssr: false,
    loading: () => (
      <div style={{ padding: 20, textAlign: "center" }}>Loading…</div>
    ),
  }
);

// Define constants outside component to ensure they're available during SSR
const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://zportaacademy.com";
const CANONICAL_URL = "https://zportaacademy.com/";
const TITLE = "Zporta Academy - Learn Courses, Lessons & Quizzes Online";
const DESCRIPTION =
  "Access comprehensive online courses, interactive lessons, and engaging quizzes. Track your progress with AI-powered study plans on Zporta Academy.";
const KEYWORDS =
  "online learning, courses, lessons, quizzes, education, study plan, AI dashboard, Zporta Academy";

export default function Page() {
  return (
    <>
      <Head>
        {/* Primary Meta Tags */}
        <title>{TITLE}</title>
        <meta name="description" content={DESCRIPTION} />
        <meta name="keywords" content={KEYWORDS} />
        <link rel="canonical" href={CANONICAL_URL} />
        <meta name="robots" content="index,follow" />
        <meta name="language" content="en-US" />
        <meta httpEquiv="content-language" content="en-US" />

        {/* Open Graph / Facebook */}
        <meta property="og:url" content={CANONICAL_URL} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={TITLE} />
        <meta property="og:description" content={DESCRIPTION} />
        <meta property="og:image" content={`${SITE}/images/default-og.png`} />
        <meta
          property="og:image:alt"
          content="Zporta Academy - Online Learning Platform"
        />
        <meta property="og:site_name" content="Zporta Academy" />
        <meta property="og:locale" content="en_US" />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={TITLE} />
        <meta name="twitter:description" content={DESCRIPTION} />
        <meta name="twitter:image" content={`${SITE}/images/default-og.png`} />
        <meta name="twitter:site" content="@ZportaAcademy" />
      </Head>
      <HomePage />
    </>
  );
}
