import Head from "next/head";
import dynamic from "next/dynamic";

const QuizAttempts = dynamic(() => import("@/components/QuizAttempts"), { ssr: false });

export default function QuizAttemptsPage() {
  return (
    <>
      <Head>
        <title>Quiz Attempts | Zporta Academy</title>
        <meta name="robots" content="noindex,nofollow" />
      </Head>
      <QuizAttempts />
    </>
  );
}
