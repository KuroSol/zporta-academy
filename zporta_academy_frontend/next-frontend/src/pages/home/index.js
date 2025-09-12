export async function getServerSideProps() {
  return {
    redirect: { destination: '/', permanent: true }, // 308
  };
}

export default function HomeRedirect() {
  return null;
}
