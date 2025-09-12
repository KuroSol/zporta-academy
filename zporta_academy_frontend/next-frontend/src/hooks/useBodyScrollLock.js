import { useEffect } from 'react';
import { lockBodyScroll, unlockBodyScroll } from '@/utils/scrollLock';

export default function useBodyScrollLock(active) {
  useEffect(() => {
    if (active) lockBodyScroll();
    return () => { if (active) unlockBodyScroll(); };
  }, [active]);
}