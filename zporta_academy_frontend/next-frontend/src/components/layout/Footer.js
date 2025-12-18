// src/components/layout/Footer.js
import React from 'react';
import Link from 'next/link';
import styles from '@/styles/Footer.module.css';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className={styles.footer}>
      <div className={styles.footerContent}>
        <div className={styles.footerSection}>
          <p className={styles.copyright}>
            &copy; {currentYear} Zporta Academy. All rights reserved.
          </p>
        </div>
        
        <div className={styles.footerSection}>
          <nav className={styles.footerNav}>
            <Link href="/legal/tokushoho" className={styles.footerLink}>
              <span className={styles.linkJa}>特定商取引法に基づく表記</span>
              <span className={styles.linkEn}>Specified Commercial Transactions Act</span>
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
