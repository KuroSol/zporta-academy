export async function getServerSideProps() {
  return {
    redirect: { destination: '/learn', permanent: true },
  };
}
export default function ExploreRedirect() { return null; }
