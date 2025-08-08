// src/pages/quizzes/[username]/[subject]/[date]/[slug]/index.js
import React from 'react'
import Head from 'next/head'
import axios from 'axios'
import he from 'he'
import { AuthProvider } from '@/context/AuthContext'
import { AuthModalProvider } from '@/context/AuthModalContext'
import QuizPage from '@/components/QuizPage'

const QuizRoute = ({ quizData, permalink }) => {
  if (!quizData) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h1>Quiz not found.</h1>
      </div>
    )
  }

  const data = quizData.quiz || quizData

  // Clean SEO Description fields
  const cleanDescription = (rawDesc, fallback) => {
    const decoded = he.decode(rawDesc || '')
      .replace(/\u00A0/g, ' ')
      .trim();
    return decoded || fallback;
  };

  const description = cleanDescription(
    data.seo_description,
    'Interactive quiz on Zporta Academy'
  );

  const ogDescription = cleanDescription(
    data.og_description || data.seo_description,
    'Check out this quiz on Zporta Academy!'
  );

  const title = data.seo_title || data.title || 'Quiz';
  const canonical = data.canonical_url || `https://zportaacademy.com/quizzes/${permalink}/`;
  const ogImage = (data.og_image?.trim())
    ? data.og_image
    : 'https://zportaacademy.com/static/default_quiz_image.png';

  return (
    <AuthProvider>
      <AuthModalProvider>
        <Head>
          <title>{title}</title>
          <meta name="description" content={description} />
          <link rel="canonical" href={canonical} />

          {/* Open Graph / Facebook */}
          <meta property="og:type" content="article" />
          <meta property="og:site_name" content="Zporta Academy" />
          <meta property="og:title" content={title} />
          <meta property="og:description" content={ogDescription} />
          <meta property="og:url" content={canonical} />
          <meta property="og:image" content={ogImage} />

          {/* Twitter */}
          <meta name="twitter:card" content="summary_large_image" />
          <meta name="twitter:title" content={title} />
          <meta name="twitter:description" content={ogDescription} />
          <meta name="twitter:image" content={ogImage} />

          {/* Encourage indexing */}
          <meta name="robots" content="index,follow" />
        </Head>

        <QuizPage initialData={data} permalink={permalink} />
      </AuthModalProvider>
    </AuthProvider>
  )
}

export async function getServerSideProps({ params }) {
  const { username, subject, date, slug } = params;
  const permalink = `${username}/${subject}/${date}/${slug}`;
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;

  try {
    const res = await axios.get(`${apiBase}quizzes/${permalink}/`);
    return { props: { quizData: res.data, permalink } };
  } catch (err) {
    console.error('SSR fetch error:', err.message);
    return { props: { quizData: null, permalink } };
  }
}

export default QuizRoute;
