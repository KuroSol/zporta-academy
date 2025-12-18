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
  const canonicalUrl = "https://zportaacademy.com/";
  const title = "Zporta Academy - Learn Courses, Lessons & Quizzes Online";
  const description =
    "Access comprehensive online courses, interactive lessons, and engaging quizzes. Track your progress with AI-powered study plans on Zporta Academy.";
  const keywords =
    "online learning, courses, lessons, quizzes, education, study plan, AI dashboard, Zporta Academy";
  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta name="keywords" content={keywords} />
        <link rel="canonical" href={canonicalUrl} />
        <meta name="robots" content="index,follow" />
        <meta name="language" content="en-US" />
        <meta httpEquiv="content-language" content="en-US" />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:image" content={`${site}/images/default-og.png`} />
        <meta
          property="og:image:alt"
          content="Zporta Academy - Online Learning Platform"
        />
        <meta property="og:site_name" content="Zporta Academy" />
        <meta property="og:locale" content="en_US" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
        <meta name="twitter:image" content={`${site}/images/default-og.png`} />
        <meta name="twitter:site" content="@ZportaAcademy" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: "Zporta Academy",
              url: site,
              description,
              inLanguage: "en-US",
              potentialAction: {
                "@type": "SearchAction",
                target: `${site}/explorer?q={search_term_string}`,
                "query-input": "required name=search_term_string",
              },
            }),
          }}
        />
      </Head>
      <HomePage />
    </>
  );
}
