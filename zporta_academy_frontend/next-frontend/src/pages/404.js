import Head from 'next/head';
import Link from 'next/link';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://zportaacademy.com';

export default function Custom404() {
  return (
    <>
      <Head>
        <title>404 - Page Not Found | Zporta Academy</title>
        <meta name="description" content="The page you're looking for doesn't exist. Explore our courses, quizzes, and lessons instead." />
        <meta name="robots" content="noindex, follow" />
        <link rel="canonical" href={SITE_URL} />
      </Head>
      
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: '20px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}>
        <h1 style={{ fontSize: '72px', margin: '0 0 20px 0', color: '#333' }}>404</h1>
        <h2 style={{ fontSize: '28px', margin: '0 0 30px 0', color: '#666' }}>Page Not Found</h2>
        <p style={{ fontSize: '16px', color: '#999', marginBottom: '40px', textAlign: 'center', maxWidth: '500px' }}>
          The page you're looking for doesn't exist or has been moved. 
          Let's get you back on track!
        </p>
        
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <Link href="/">
            <a style={{
              padding: '12px 24px',
              backgroundColor: '#007bff',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '4px',
              fontSize: '16px',
            }}>
              Go Home
            </a>
          </Link>
          
          <Link href="/explore">
            <a style={{
              padding: '12px 24px',
              backgroundColor: '#6c757d',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '4px',
              fontSize: '16px',
            }}>
              Explore Courses
            </a>
          </Link>
          
          <Link href="/quizzes">
            <a style={{
              padding: '12px 24px',
              backgroundColor: '#6c757d',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '4px',
              fontSize: '16px',
            }}>
              Take a Quiz
            </a>
          </Link>
        </div>
      </div>
    </>
  );
}
