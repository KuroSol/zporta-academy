import dynamic from "next/dynamic";
import Head from "next/head";

const HomePage = dynamic(
  () => import("@/components/HomePage").then((m) => m.default || m),
  {
    ssr: false,
    loading: () => (
      <div style={{ padding: 20, textAlign: "center" }}>Loading…</div>
    ),
  }
);

export default function Page() {
  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://zportaacademy.com";

  return (
    <>
      <Head>
        {/* Core SEO tags now handled by _document.js for SSR */}
        {/* Additional homepage-specific meta tags */}
        <meta
          name="keywords"
          content="online learning, courses, lessons, quizzes, education, study plan, AI dashboard, Zporta Academy"
        />
        <meta name="language" content="en-US" />
        <meta httpEquiv="content-language" content="en-US" />
        <meta property="og:image" content={`${site}/images/default-og.png`} />
        <meta
          property="og:image:alt"
          content="Zporta Academy - Online Learning Platform"
        />
        <meta property="og:locale" content="en_US" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:image" content={`${site}/images/default-og.png`} />
        <meta name="twitter:site" content="@ZportaAcademy" />
      </Head>
      <HomePage />
    </>
  );
}
