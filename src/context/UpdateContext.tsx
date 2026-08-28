import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { APP_VERSION, APP_BUILD_NUMBER, APP_BUILD_DATE } from '../config/version';

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000; // 72 hours grace period

interface UpdateContextType {
  currentVersion: string;
  buildDate: string;
  buildNumber: number;
  isUpdateAvailable: boolean;
  latestVersion: string;
  isCheckingUpdate: boolean;
  isApplyingUpdate: boolean;
  isEnforcedMandatory: boolean;
  daysRemaining: number;
  lastCheckedTime: Date | null;
  checkForUpdates: (manual?: boolean) => Promise<boolean>;
  applyUpdate: () => Promise<void>;
  forceCleanUpdate: () => Promise<void>;
  dismissBanner: () => void;
  isBannerDismissed: boolean;
}

const UpdateContext = createContext<UpdateContextType | undefined>(undefined);

export const UpdateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isUpdateAvailable, setIsUpdateAvailable] = useState(false);
  const [latestVersion, setLatestVersion] = useState(APP_VERSION);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [isApplyingUpdate, setIsApplyingUpdate] = useState(false);
  const [isEnforcedMandatory, setIsEnforcedMandatory] = useState(false);
  const [daysRemaining, setDaysRemaining] = useState(3);
  const [lastCheckedTime, setLastCheckedTime] = useState<Date | null>(null);
  const [isBannerDismissed, setIsBannerDismissed] = useState(false);

  const swRegistrationRef = useRef<ServiceWorkerRegistration | null>(null);

  // Compare semantic / build numbers safely
  const isServerVersionNewer = (serverVer: string, serverBuild?: number): boolean => {
    if (serverBuild && serverBuild > APP_BUILD_NUMBER) return true;
    if (serverVer && serverVer !== APP_VERSION) {
      const cleanServer = serverVer.replace(/[^\d.]/g, '').split('.').map(Number);
      const cleanLocal = APP_VERSION.replace(/[^\d.]/g, '').split('.').map(Number);
      for (let i = 0; i < Math.max(cleanServer.length, cleanLocal.length); i++) {
        const s = cleanServer[i] || 0;
        const l = cleanLocal[i] || 0;
        if (s > l) return true;
        if (s < l) return false;
      }
      return serverVer !== APP_VERSION;
    }
    return false;
  };

  // Calculate 3-day deadline and dispatch in-app notification event
  const processVersionTimeline = useCallback((ver: string, serverTimestamp?: number) => {
    try {
      const storageKey = `gofield_update_first_seen_${ver}`;
      let firstSeen = localStorage.getItem(storageKey);
      if (!firstSeen) {
        firstSeen = Date.now().toString();
        localStorage.setItem(storageKey, firstSeen);
      }

      const releaseTime = serverTimestamp ? Math.min(serverTimestamp, Number(firstSeen)) : Number(firstSeen);
      const elapsedMs = Math.max(0, Date.now() - releaseTime);
      const remainingMs = Math.max(0, THREE_DAYS_MS - elapsedMs);
      const remDays = Math.max(0, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)));
      const isMandatory = elapsedMs >= THREE_DAYS_MS;

      setDaysRemaining(remDays);
      setIsEnforcedMandatory(isMandatory);

      if (isMandatory) {
        setIsBannerDismissed(false);
      }

      // Dispatch event for in-app notification center
      window.dispatchEvent(
        new CustomEvent('gofield:new_version_available', {
          detail: {
            version: ver,
            daysRemaining: remDays,
            isMandatory,
          },
        })
      );
    } catch (e) {
      console.warn('Error processing version timeline:', e);
    }
  }, []);

  // Check for updates against server version.json and Service Worker
  const checkForUpdates = useCallback(async (manual = false): Promise<boolean> => {
    if (!navigator.onLine) {
      if (manual) {
        console.log('[Update] Dispositivo offline. Não foi possível checar atualizações.');
      }
      return false;
    }

    setIsCheckingUpdate(true);
    try {
      // 1. Fetch server version.json with aggressive cache-busting
      const timestamp = Date.now();
      const res = await fetch(`/version.json?_t=${timestamp}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });

      if (res.ok) {
        const data = await res.json();
        setLastCheckedTime(new Date());

        if (data.version && isServerVersionNewer(data.version, data.buildNumber)) {
          console.log(`[Update] Nova versão detectada no servidor: ${data.version} (Atual: ${APP_VERSION})`);
          setLatestVersion(data.version);
          setIsUpdateAvailable(true);
          setIsBannerDismissed(false);
          processVersionTimeline(data.version, data.releaseTimestamp);
          setIsCheckingUpdate(false);
          return true;
        }
      }

      // 2. Query Service Worker Registration update
      if (swRegistrationRef.current) {
        try {
          await swRegistrationRef.current.update();
          if (swRegistrationRef.current.waiting) {
            setIsUpdateAvailable(true);
            setIsBannerDismissed(false);
            processVersionTimeline(latestVersion);
            setIsCheckingUpdate(false);
            return true;
          }
        } catch (swErr) {
          console.warn('[Update] Erro ao verificar Service Worker:', swErr);
        }
      }

      setLastCheckedTime(new Date());
      setIsCheckingUpdate(false);
      return false;
    } catch (err) {
      console.warn('[Update] Erro ao checar atualizações:', err);
      setIsCheckingUpdate(false);
      return false;
    }
  }, [processVersionTimeline, latestVersion]);

  // Apply update immediately
  const applyUpdate = useCallback(async () => {
    setIsApplyingUpdate(true);
    try {
      // 1. Tell waiting service worker to skip waiting
      if (swRegistrationRef.current && swRegistrationRef.current.waiting) {
        swRegistrationRef.current.waiting.postMessage({ type: 'SKIP_WAITING' });
      }

      // 2. Clear old caches except user's persistent IndexedDB
      if ('caches' in window) {
        const cacheKeys = await caches.keys();
        await Promise.all(
          cacheKeys.map((key) => {
            if (!key.includes(latestVersion)) {
              return caches.delete(key);
            }
          })
        );
      }

      // 3. Force reload page with cache bypass
      setTimeout(() => {
        window.location.href = window.location.origin + '?_update=' + Date.now();
      }, 400);
    } catch (err) {
      console.error('[Update] Erro ao aplicar atualização:', err);
      window.location.reload();
    }
  }, [latestVersion]);

  // Force clean update (nuclear option for clean cache purge)
  const forceCleanUpdate = useCallback(async () => {
    setIsApplyingUpdate(true);
    try {
      if (swRegistrationRef.current) {
        if (swRegistrationRef.current.waiting) {
          swRegistrationRef.current.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
        if (swRegistrationRef.current.active) {
          swRegistrationRef.current.active.postMessage({ type: 'SKIP_WAITING' });
        }
      }

      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of registrations) {
          await reg.unregister();
        }
      }

      if ('caches' in window) {
        const cacheKeys = await caches.keys();
        await Promise.all(cacheKeys.map((key) => caches.delete(key)));
      }

      localStorage.setItem('geofield_last_force_update', Date.now().toString());

      setTimeout(() => {
        window.location.href = window.location.origin + '?_force_update=' + Date.now();
      }, 500);
    } catch (err) {
      console.error('[Update] Erro na limpeza forçada:', err);
      window.location.reload();
    }
  }, []);

  // Setup Service Worker listeners on mount
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    let refreshing = false;
    // When the service worker controlling the page changes, reload once
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        console.log('[Update] Novo Service Worker assumiu o controle. Recarregando...');
        window.location.reload();
      }
    });

    navigator.serviceWorker.getRegistration().then((reg) => {
      if (reg) {
        swRegistrationRef.current = reg;

        // Check if there is already a waiting worker
        if (reg.waiting) {
          setIsUpdateAvailable(true);
        }

        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('[Update] Nova versão instalada em segundo plano.');
                setIsUpdateAvailable(true);
                setIsBannerDismissed(false);
              }
            });
          }
        });
      }
    });

    // Check on startup
    const initialTimer = setTimeout(() => {
      checkForUpdates(false);
    }, 2500);

    // Check automatically when app comes back to foreground (User unlocks phone or returns to tab)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkForUpdates(false);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Periodic check every 15 minutes (skipped when phone is locked/hidden)
    const intervalTimer = setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      checkForUpdates(false);
    }, 15 * 60 * 1000);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(intervalTimer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [checkForUpdates]);

  const dismissBanner = () => {
    setIsBannerDismissed(true);
  };

  return (
    <UpdateContext.Provider
      value={{
        currentVersion: APP_VERSION,
        buildDate: APP_BUILD_DATE,
        buildNumber: APP_BUILD_NUMBER,
        isUpdateAvailable,
        latestVersion,
        isCheckingUpdate,
        isApplyingUpdate,
        lastCheckedTime,
        checkForUpdates,
        applyUpdate,
        forceCleanUpdate,
        dismissBanner,
        isBannerDismissed,
      }}
    >
      {children}
    </UpdateContext.Provider>
  );
};

export const useUpdate = (): UpdateContextType => {
  const context = useContext(UpdateContext);
  if (!context) {
    throw new Error('useUpdate must be used within an UpdateProvider');
  }
  return context;
};
