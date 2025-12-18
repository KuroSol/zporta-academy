import Head from "next/head";
import Link from "next/link";
import styles from "@/styles/LegalPage.module.css";

export default function TokushohoPage() {
  const site = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.zportaacademy.com';
  const title = 'Specified Commercial Transactions Act - 特定商取引法に基づく表記 | Zporta Academy';
  const description = 'Specified Commercial Transactions Act disclosure for Zporta Academy';

  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={`${site}/legal/tokushoho`} />
        <meta name="robots" content="index,follow" />
      </Head>

      <div className={styles.legalPageContainer}>
        <div className={styles.backToHome}>
          <Link href="/" className={styles.backLink}>
            ← Back to Home / ホームに戻る
          </Link>
        </div>
        
        <div className={styles.legalContent}>
          {/* English Section */}
          <section className={styles.languageSection}>
            <div className={styles.sectionHeader}>
              <h1 className={styles.mainTitle}>Specified Commercial Transactions Act Disclosure</h1>
              <p className={styles.language}>English</p>
            </div>

            <div className={styles.section}>
              <h2>Seller Information</h2>
              <div className={styles.infoBlock}>
                <p><strong>Service name:</strong> Zporta Academy</p>
                <p><strong>Seller (Legal name):</strong> <span className={styles.placeholder}>[Your legal entity name in Japan, e.g., 株式会社Zporta / Your sole proprietor name]</span></p>
                <p><strong>Representative / Responsible person:</strong> <span className={styles.placeholder}>[Your name]</span></p>
                <p><strong>Business address:</strong> <span className={styles.placeholder}>[Full address]</span></p>
                <p><strong>Phone number:</strong> <span className={styles.placeholder}>[Phone number]</span></p>
                <p><strong>Email:</strong> <span className={styles.placeholder}>[Support email address]</span></p>
                <p><strong>Website:</strong> <a href="https://zportaacademy.com">https://zportaacademy.com</a></p>
              </div>
            </div>

            <div className={styles.section}>
              <h2>Products and Services</h2>
              <p>We provide the following:</p>
              <ul>
                <li><strong>Digital self-study courses (web-based):</strong> text lessons, quizzes, and practice materials</li>
                <li><strong>Private lessons (services):</strong> English lessons and computer programming lessons (online and face-to-face)</li>
              </ul>
            </div>

            <div className={styles.section}>
              <h2>Prices</h2>
              <p>Prices are displayed on each product or service page.</p>
              <p><strong>Tax:</strong> <span className={styles.placeholder}>[e.g., Tax included / Tax excluded. If excluded, state how tax is handled.]</span></p>
            </div>

            <div className={styles.section}>
              <h2>Additional Fees</h2>
              <p>No shipping fees.</p>
              <p>Internet connection and device costs are the customer&rsquo;s responsibility.</p>
            </div>

            <div className={styles.section}>
              <h2>Payment Methods</h2>
              <ul>
                <li>Credit card payments via Stripe (Stripe Checkout, Stripe Payment Links)</li>
                <li>Bank transfer (only if offered and approved individually)</li>
              </ul>
            </div>

            <div className={styles.section}>
              <h2>Payment Timing</h2>
              <p>Payment is charged at the time of purchase.</p>
            </div>

            <div className={styles.section}>
              <h2>Delivery and Service Timing</h2>
              <ul>
                <li><strong>Digital courses:</strong> available after payment confirmation and account access is granted</li>
                <li><strong>Private lessons:</strong> scheduled after payment; details are provided by email or inside the user account</li>
              </ul>
            </div>

            <div className={styles.section}>
              <h2>Cancellations and Refund Policy</h2>
              <div className={styles.subsection}>
                <h3>Digital courses:</h3>
                <p className={styles.placeholder}>[Example option] Refunds are not available after access is granted, unless required by law.</p>
              </div>
              <div className={styles.subsection}>
                <h3>Private lessons:</h3>
                <p className={styles.placeholder}>[Example option] Cancellations must be made at least [24] hours before the scheduled start time. Late cancellations or no-shows are not refundable.</p>
              </div>
            </div>

            <div className={styles.section}>
              <h2>Operating Environment</h2>
              <p>This service requires an internet connection and a modern web browser (Chrome, Safari, Edge). Some content may require audio playback support.</p>
            </div>

            <div className={styles.section}>
              <h2>Notes</h2>
              <p>Results vary depending on the learner. We do not guarantee specific outcomes.</p>
            </div>
          </section>

          {/* Japanese Section */}
          <section className={styles.languageSection}>
            <div className={styles.sectionHeader}>
              <h1 className={styles.mainTitle}>特定商取引法に基づく表記</h1>
              <p className={styles.language}>日本語</p>
            </div>

            <div className={styles.section}>
              <h2>販売事業者</h2>
              <div className={styles.infoBlock}>
                <p><strong>サービス名:</strong> Zporta Academy（ゼポータアカデミー）</p>
                <p><strong>販売事業者名（法人名または屋号）:</strong> <span className={styles.placeholder}>[株式会社Zporta / 屋号など]</span></p>
                <p><strong>運営責任者:</strong> <span className={styles.placeholder}>[あなたの名前]</span></p>
                <p><strong>所在地:</strong> <span className={styles.placeholder}>[住所]</span></p>
                <p><strong>電話番号:</strong> <span className={styles.placeholder}>[電話番号]</span></p>
                <p><strong>メールアドレス:</strong> <span className={styles.placeholder}>[サポート用メール]</span></p>
                <p><strong>ウェブサイト:</strong> <a href="https://zportaacademy.com">https://zportaacademy.com</a></p>
              </div>
            </div>

            <div className={styles.section}>
              <h2>販売価格</h2>
              <p>各商品またはサービスのページに表示します。</p>
              <p><strong>消費税:</strong> <span className={styles.placeholder}>[税込 / 税別。税別の場合は税の扱いを明記]</span></p>
            </div>

            <div className={styles.section}>
              <h2>商品代金以外の必要料金</h2>
              <p>送料はありません。</p>
              <p>インターネット接続にかかる通信費や端末費用はお客様負担となります。</p>
            </div>

            <div className={styles.section}>
              <h2>提供内容（商品・役務）</h2>
              <ul>
                <li><strong>オンライン自習コース（デジタルコンテンツ）:</strong> テキストレッスン、クイズ、練習教材</li>
                <li><strong>個別レッスン（役務）:</strong> 英語レッスン、プログラミングレッスン（オンラインおよび対面）</li>
              </ul>
            </div>

            <div className={styles.section}>
              <h2>お支払い方法</h2>
              <ul>
                <li>クレジットカード決済（Stripe）（Stripe Checkout、Stripe Payment Links）</li>
                <li>銀行振込（対応する場合のみ、個別に案内）</li>
              </ul>
            </div>

            <div className={styles.section}>
              <h2>お支払い時期</h2>
              <p>ご購入時に決済が確定します。</p>
            </div>

            <div className={styles.section}>
              <h2>引き渡し時期・提供時期</h2>
              <ul>
                <li><strong>デジタルコース:</strong> 決済確認後、アカウントにて閲覧可能になります</li>
                <li><strong>個別レッスン:</strong> 決済後に日程調整を行い、メールまたはアカウント内で案内します</li>
              </ul>
            </div>

            <div className={styles.section}>
              <h2>キャンセル・返金について</h2>
              <div className={styles.subsection}>
                <h3>デジタルコース:</h3>
                <p className={styles.placeholder}>[例] 利用開始（アクセス付与）後の返金は原則として承っておりません。ただし法令により必要な場合を除きます。</p>
              </div>
              <div className={styles.subsection}>
                <h3>個別レッスン:</h3>
                <p className={styles.placeholder}>[例] レッスン開始の[24]時間前までにご連絡ください。それ以降のキャンセル、無断欠席は返金できません。</p>
              </div>
            </div>

            <div className={styles.section}>
              <h2>動作環境</h2>
              <p>本サービスの利用にはインターネット接続および最新のブラウザ（Chrome / Safari / Edge）が必要です。音声教材を含む場合、音声再生が可能な環境が必要です。</p>
            </div>

            <div className={styles.section}>
              <h2>表現および再現性についての注意書き</h2>
              <p>学習効果には個人差があり、成果を保証するものではありません。</p>
            </div>
          </section>
        </div>

        <footer className={styles.legalFooter}>
          <div className={styles.footerContent}>
            <p>&copy; {new Date().getFullYear()} Zporta Academy. All rights reserved.</p>
            <Link href="/" className={styles.footerHomeLink}>
              Home / ホーム
            </Link>
          </div>
        </footer>
      </div>
    </>
  );
}

// This page doesn't require authentication, so we'll disable the default layout
TokushohoPage.getLayout = (page) => page;
