import { useEffect, useState } from 'react';
import { toast } from 'sonner';

export function useServiceWorkerUpdate() {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [hasShownToast, setHasShownToast] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    let updateToastId: string | number | undefined;

    const handleSkipWaiting = (worker: ServiceWorker) => {
      worker.postMessage({ type: 'SKIP_WAITING' });
    };

    const showUpdateToast = () => {
      if (hasShownToast || updateToastId) return;

      updateToastId = toast.success('发现新版本', {
        description: '点击更新以获取最新功能',
        action: {
          label: '立即更新',
          onClick: () => {
            if (waitingWorker) {
              handleSkipWaiting(waitingWorker);
            } else if (registration?.waiting) {
              handleSkipWaiting(registration.waiting);
            }
          },
        },
        duration: Infinity,
      });

      setHasShownToast(true);
    };

    const onWorkerStateChange = (e: Event) => {
      const worker = e.target as ServiceWorker;
      if (worker.state === 'installed' && navigator.serviceWorker.controller) {
        setWaitingWorker(worker);
        showUpdateToast();
      }
    };

    const registerSW = async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js');
        setRegistration(reg);

        if (reg.waiting) {
          setWaitingWorker(reg.waiting);
          showUpdateToast();
        } else if (reg.installing) {
          reg.installing.addEventListener('statechange', onWorkerStateChange);
        }

        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', onWorkerStateChange);
        });
      } catch (error) {
        console.error('Service Worker registration failed:', error);
      }
    };

    registerSW();

    const handleControllerChange = () => {
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
      if (updateToastId) {
        toast.dismiss(updateToastId);
      }
    };
  }, [hasShownToast, waitingWorker, registration]);

  return { registration, waitingWorker };
}
