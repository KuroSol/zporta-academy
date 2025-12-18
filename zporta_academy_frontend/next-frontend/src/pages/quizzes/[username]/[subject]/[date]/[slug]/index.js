import QuizPage from "@/components/QuizPage";

export default function Page({ quiz, username, subject, date, slug }) {
  return (
    <QuizPage
      initialData={quiz}
      username={username}
      subject={subject}
      date={date}
      slug={slug}
    />
  );
}

export async function getServerSideProps(ctx) {
  const { username, subject, date, slug } = ctx.params;
  const permalink = `${username}/${subject}/${date}/${slug}`;

  const base =
    process.env.API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    "http://127.0.0.1:8000/api/";
  // Replace localhost with 127.0.0.1 for Windows SSR compatibility
  const url = `${base
    .replace(/\/+$/, "")
    .replace("localhost", "127.0.0.1")}/quizzes/${permalink}/`;

  let quiz = null;
  try {
    console.log(`[SSR] Fetching quiz from: ${url}`);
    const r = await fetch(url, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(5000),
    });
    console.log(`[SSR] Response status: ${r.status}`);
    if (r.ok) {
      const data = await r.json();
      console.log(`[SSR] Response data keys:`, Object.keys(data));
      quiz = data.quiz || data;
      console.log(
        `[SSR] Quiz extracted - ID: ${quiz?.id}, Status: ${quiz?.status}, Type: ${quiz?.quiz_type}`
      );
    } else {
      console.error(`[SSR] Fetch failed with status ${r.status}`);
    }
  } catch (e) {
    console.error("SSR fetch quiz failed:", e.message);
  }

  if (!quiz) {
    console.log(`[SSR] No quiz data - returning 404`);
    return { notFound: true };
  }

  if (quiz.status !== "published") {
    console.log(
      `[SSR] Quiz status is "${quiz.status}", not "published" - returning 404`
    );
    return { notFound: true };
  }

  if (quiz.quiz_type !== "free") {
    console.log(
      `[SSR] Quiz type is "${quiz.quiz_type}", not "free" - returning 404`
    );
    return { notFound: true };
  }

  return { props: { quiz, username, subject, date, slug } };
}
