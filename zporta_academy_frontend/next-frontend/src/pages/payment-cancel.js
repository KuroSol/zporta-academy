import Head from 'next/head';
import PaymentCancel from '@/components/PaymentCancel';

export default function PaymentCancelPage() {
  return (
    <>
      <Head>
        <title>Payment Cancelled</title>
        <meta name="robots" content="noindex" />
      </Head>
      <PaymentCancel />
    </>
  );
}