import Head from 'next/head';
import PaymentSuccess from '@/components/PaymentSuccess';

export default function PaymentSuccessPage() {
  return (
    <>
      <Head>
        <title>Payment Successful</title>
        <meta name="robots" content="noindex" />
      </Head>
      <PaymentSuccess />
    </>
  );
}