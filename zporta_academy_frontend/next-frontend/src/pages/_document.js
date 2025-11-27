import Document, { Html, Head, Main, NextScript } from "next/document";

export default class MyDocument extends Document {
  render() {
    return (
      <Html lang="en">
        <Head>
          {/**
           * Next.js dev/style loader expects this anchor to ensure CSS is inserted in the right order.
           * If it doesn't exist, style injection may throw when reading `parentNode` of null.
           */}
          <noscript id="__next_css__DO_NOT_USE__" />
          {/* Organization + Website JSON-LD */}
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                '@context': 'https://schema.org',
                '@type': 'Organization',
                name: 'Zporta Academy',
                url: 'https://zportaacademy.com',
                logo: 'https://zportaacademy.com/android-chrome-512x512.png'
              })
            }}
          />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                '@context': 'https://schema.org',
                '@type': 'WebSite',
                name: 'Zporta Academy',
                url: 'https://zportaacademy.com',
                potentialAction: {
                  '@type': 'SearchAction',
                  target: 'https://zportaacademy.com/explore/search?q={search_term_string}',
                  'query-input': 'required name=search_term_string'
                }
              })
            }}
          />
        </Head>
        <body className="antialiased">
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}
