import Head from "next/head";
import dynamic from "next/dynamic";

const Analytics = dynamic(() => import("@/components/Analytics"), { ssr: false });

export default function AnalyticsPage() {
  return (
    <>
      <Head>
        <title>Analytics & Statistics | Zporta Academy</title>
        <meta name="robots" content="noindex,nofollow" />
      </Head>
      <Analytics />
    </>
  );
}
