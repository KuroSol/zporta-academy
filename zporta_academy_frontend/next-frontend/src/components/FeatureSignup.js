// src/components/FeatureSignup.js
import React from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import GoogleSignupButton from "@/components/auth/GoogleSignupButton";
import styles from "@/styles/FeatureSignup.module.css";

const Register = dynamic(
  () => import("@/components/Register").then((m) => m.default || m),
  { ssr: false }
);

export default function FeatureSignup({
  title,
  subtitle,
  bullets = [],
  samples = [],
}) {
  return (
    <div className={styles.page}>
      <section className={styles.topBar}>
        <div className={styles.topLeft}>
          <h1 className={styles.title}>{title}</h1>
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
        </div>
        <div className={styles.topRight}>
          <GoogleSignupButton className={styles.googleBtn} />
          <div className={styles.loginLink}>
            <span>Already a member?</span> <Link href="/login">Log in</Link>
          </div>
        </div>
      </section>

      {bullets?.length > 0 && (
        <section className={styles.bullets}>
          {bullets.map((b, i) => (
            <div key={i} className={styles.bulletCard}>
              <h3>{b.title}</h3>
              <p>{b.desc}</p>
            </div>
          ))}
        </section>
      )}

      {samples?.length > 0 && (
        <section className={styles.samples}>
          <h2 className={styles.samplesTitle}>See It In Action</h2>
          <div className={styles.sampleGrid}>
            {samples.map((s, idx) => (
              <a
                key={idx}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.sampleCard}
              >
                <div className={styles.sampleHeader}>{s.title}</div>
                <p className={styles.sampleDesc}>{s.desc}</p>
              </a>
            ))}
          </div>
          <p className={styles.samplesNote}>Opening previews in a new tab.</p>
        </section>
      )}

      <section className={styles.registerSection}>
        <div className={styles.registerHeading}>
          <h2>Create your account</h2>
          <p>Join with Google on top or use email below.</p>
        </div>
        <Register />
      </section>
    </div>
  );
}
