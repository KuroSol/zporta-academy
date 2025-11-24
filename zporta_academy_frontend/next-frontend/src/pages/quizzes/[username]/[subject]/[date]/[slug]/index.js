import QuizPage from "@/components/QuizPage";

export default function Page({ quiz, username, subject, date, slug }) {
  return <QuizPage initialData={quiz} username={username} subject={subject} date={date} slug={slug} />;
}

export async function getServerSideProps(ctx) {
  const { username, subject, date, slug } = ctx.params;
  const permalink = `${username}/${subject}/${date}/${slug}`;

  const base =
    process.env.API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    "http://127.0.0.1:8000/api/";
  // Replace localhost with 127.0.0.1 for Windows SSR compatibility
  const url = `${base.replace(/\/+$/, "").replace('localhost', '127.0.0.1')}/quizzes/${permalink}/`;

  let quiz = null;
  try {
    const r = await fetch(url, { 
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(5000)
    });
    if (r.ok) {
      const data = await r.json();
      quiz = data.quiz || data;
    }
  } catch (e) {
    console.error("SSR fetch quiz failed:", e.message);
  }

  if (!quiz || quiz.status !== "published" || quiz.quiz_type !== "free") {
    return { notFound: true };
  }

  return { props: { quiz, username, subject, date, slug } };
}
