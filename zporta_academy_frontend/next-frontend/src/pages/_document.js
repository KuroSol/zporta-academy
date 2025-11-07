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
        </Head>
        <body className="antialiased">
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}
