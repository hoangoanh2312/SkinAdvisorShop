let scriptPromise;

const loadGoogleIdentity = () => {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (!scriptPromise) scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => window.google?.accounts?.oauth2 ? resolve() : reject(new Error("GOOGLE_LIBRARY_UNAVAILABLE"));
    script.onerror = () => reject(new Error("GOOGLE_LIBRARY_UNAVAILABLE"));
    document.head.appendChild(script);
  }).catch(error => { scriptPromise = null; throw error; });
  return scriptPromise;
};

export async function requestGoogleCode() {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim();
  if (!clientId) throw new Error("GOOGLE_NOT_CONFIGURED");
  await loadGoogleIdentity();
  return new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initCodeClient({
      client_id: clientId,
      scope: "openid email profile",
      ux_mode: "popup",
      select_account: true,
      callback: response => response?.code ? resolve(response.code) : reject(new Error("GOOGLE_CODE_MISSING")),
      error_callback: () => reject(new Error("GOOGLE_POPUP_CLOSED")),
    });
    client.requestCode();
  });
}
