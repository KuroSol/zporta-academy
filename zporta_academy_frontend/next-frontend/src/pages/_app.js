import '../styles/globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { AuthModalProvider } from '@/context/AuthModalContext';

function MyApp({ Component, pageProps }) {
  return (
    <AuthProvider>
      <AuthModalProvider>
        <Component {...pageProps} />
      </AuthModalProvider>
    </AuthProvider>
  );
}

export default MyApp;
