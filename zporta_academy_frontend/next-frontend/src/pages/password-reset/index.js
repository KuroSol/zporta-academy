import PasswordReset from '@/components/auth/PasswordReset';

export default function Page() {
  return <PasswordReset />;
}

// Disable global chrome (header/sidebar) for a clean auth layout
Page.hideChrome = true;
Page.getLayout = (page) => page;