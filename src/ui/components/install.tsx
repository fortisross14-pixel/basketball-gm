import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    listeners.forEach((f) => f());
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    listeners.forEach((f) => f());
  });
}

function isStandalone() {
  return typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);
}

/** "Install app" button: uses the browser's install prompt when available, otherwise explains how. */
export function InstallButton({ compact }: { compact?: boolean }) {
  const [, force] = useState(0);
  const [help, setHelp] = useState(false);
  useEffect(() => {
    const f = () => force((n) => n + 1);
    listeners.add(f);
    return () => { listeners.delete(f); };
  }, []);
  if (isStandalone()) return compact ? null : <span className="badge good">Installed app</span>;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  return (
    <span className="row gap4" style={{ position: 'relative' }}>
      <button
        type="button"
        className={`btn ${compact ? 'sm' : ''}`}
        onClick={async () => {
          if (deferred) {
            await deferred.prompt();
            await deferred.userChoice;
            deferred = null;
            force((n) => n + 1);
          } else setHelp((v) => !v);
        }}
      >
        ⬇ Install app
      </button>
      {help && (
        <span className="callout small" style={{ position: 'absolute', top: '110%', left: 0, width: 300, zIndex: 30 }}>
          {ios ? 'On iPhone/iPad: tap Share, then "Add to Home Screen".' : 'Use your browser menu → "Install Basketball Dynasty" (or "Add to Home screen"). If you just opened the page, wait a few seconds and try again.'}
        </span>
      )}
    </span>
  );
}
