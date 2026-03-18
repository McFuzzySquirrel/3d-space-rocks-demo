const SERVICE_WORKER_URL = "/sw.js";

function canRegisterServiceWorker(): boolean {
  return import.meta.env.PROD && "serviceWorker" in navigator && window.isSecureContext;
}

async function registerWorker(): Promise<void> {
  try {
    const registration = await navigator.serviceWorker.register(SERVICE_WORKER_URL, {
      scope: "/"
    });

    const promoteWaitingWorker = (): void => {
      registration.waiting?.postMessage({ type: "SKIP_WAITING" });
    };

    if (registration.waiting) {
      promoteWaitingWorker();
    }

    registration.addEventListener("updatefound", () => {
      const installingWorker = registration.installing;

      if (!installingWorker) {
        return;
      }

      installingWorker.addEventListener("statechange", () => {
        if (installingWorker.state === "installed" && navigator.serviceWorker.controller) {
          promoteWaitingWorker();
        }
      });
    });
  } catch (error) {
    console.warn("Service worker registration failed.", error);
  }
}

export function registerServiceWorker(): void {
  if (!canRegisterServiceWorker()) {
    return;
  }

  if (document.readyState === "complete") {
    void registerWorker();
    return;
  }

  window.addEventListener("load", () => {
    void registerWorker();
  }, { once: true });
}