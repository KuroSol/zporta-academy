// src/pages/index.js
export default function Index() {
  return null;
}

export async function getServerSideProps() {
  const dest =
    process.env.MAIN_ORIGIN ||
    process.env.NEXT_PUBLIC_MAIN_ORIGIN ||
    '/';
  return { redirect: { destination: dest, permanent: false } };
}
