import Head from "next/head";
import dynamic from "next/dynamic";

const FilterPreferences = dynamic(() => import("@/components/FilterPreferences"), { ssr: false });

export default function SetupPage() {
  return (
    <>
      <Head>
        <title>Setup | Content Preferences</title>
        <meta name="robots" content="noindex,nofollow" />
      </Head>
      <section style={{ maxWidth: 1200, margin: "0 auto", padding: "1rem 2rem" }}>
        <h1 style={{ marginBottom: 8 }}>Your Content Preferences</h1>
        <p style={{ marginTop: 0, color: "#5a6a7e" }}>
          These settings personalize what you see across Zporta Academy.
        </p>
        <FilterPreferences />
      </section>
    </>
  );
}
