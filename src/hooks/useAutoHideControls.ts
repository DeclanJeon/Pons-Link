import { useEffect, useRef } from 'react';
import { useUIManagementStore } from '@/stores/useUIManagementStore';

export const useAutoHideControls = (delay: number = 3000) => {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleActivity = () => {
      const { setControlBarVisible } = useUIManagementStore.getState();
      
      setControlBarVisible(true);

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        const { setControlBarVisible: setVisible } = useUIManagementStore.getState();
        setVisible(false);
      }, delay);
    };

    handleActivity();

    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'];
    
    events.forEach(event => {
      document.addEventListener(event, handleActivity, { passive: true });
    });

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleActivity);
      });
      
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [delay]);
};