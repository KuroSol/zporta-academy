// src/pages/_app.js
 import '../styles/SidebarMenu.css';
 import '../styles/globals.css';
 import { AuthProvider } from '../context/AuthContext';
 import { AuthModalProvider } from '../context/AuthModalContext';
 import AppLayout from '../components/layout/AppLayout';

function MyApp({ Component, pageProps }) {
  // Option A: page can set `Component.hideChrome = true` to hide header/sidebar
  const enabled = Component.hideChrome ? false : true;

  // Option B: page can provide a custom getLayout if needed
  const getLayout = Component.getLayout || ((page) => (
    <AppLayout enabled={enabled}>{page}</AppLayout>
  ));

  return (
    <AuthProvider>
      <AuthModalProvider>
        {getLayout(<Component {...pageProps} />)}
      </AuthModalProvider>
    </AuthProvider>
  );
}

export default MyApp;
