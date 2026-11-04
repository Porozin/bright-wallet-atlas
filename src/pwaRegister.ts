export function registerPWA() {
  if (typeof window !== "undefined" && "serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("/service-worker.js")
        .then((registration) => {
          console.log("[PWA] Service Worker registrado com sucesso: ", registration.scope);
        })
        .catch((error) => {
          console.error("[PWA] Falha ao registrar Service Worker: ", error);
        });
    });
  }
}
