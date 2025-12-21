import Head from "next/head";
import Link from "next/link";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://zportaacademy.com";

export default function Custom500() {
  return (
    <>
      <Head>
        <title>500 - Server Error | Zporta Academy</title>
        <meta
          name="description"
          content="Something went wrong on our end. Our team has been notified and is working on it."
        />
        <meta name="robots" content="noindex, follow" />
        <link rel="canonical" href={SITE_URL} />
      </Head>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          padding: "20px",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <h1 style={{ fontSize: "72px", margin: "0 0 20px 0", color: "#333" }}>
          500
        </h1>
        <h2 style={{ fontSize: "28px", margin: "0 0 30px 0", color: "#666" }}>
          Server Error
        </h2>
        <p
          style={{
            fontSize: "16px",
            color: "#999",
            marginBottom: "40px",
            textAlign: "center",
            maxWidth: "500px",
          }}
        >
          Something went wrong on our end. Our team has been notified and is
          working to fix it. Please try again later or contact our support team.
        </p>

        <div
          style={{
            display: "flex",
            gap: "20px",
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          <Link href="/">
            <a
              style={{
                padding: "12px 24px",
                backgroundColor: "#007bff",
                color: "white",
                textDecoration: "none",
                borderRadius: "4px",
                fontSize: "16px",
              }}
            >
              Go Home
            </a>
          </Link>

          <a
            href="mailto:support@zportaacademy.com"
            style={{
              padding: "12px 24px",
              backgroundColor: "#6c757d",
              color: "white",
              textDecoration: "none",
              borderRadius: "4px",
              fontSize: "16px",
            }}
          >
            Contact Support
          </a>
        </div>
      </div>
    </>
  );
}
