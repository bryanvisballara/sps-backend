export type PushRegistrationResult =
  | { status: "granted" }
  | { status: "denied" }
  | { status: "default" }
  | { status: "unsupported"; reason: string }
  | { status: "config-unavailable" }
  | { status: "error"; message: string };

type PushConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  vapidKey: string;
};

const PUSH_TOKEN_STORAGE_KEY = "sps-push-fcm-token";

let firebaseApp: import("firebase/app").FirebaseApp | null = null;
let messagingClient: import("firebase/messaging").Messaging | null = null;
let foregroundListenerAttached = false;

function detectIosSafari() {
  if (typeof navigator === "undefined") {
    return false;
  }

  const userAgent = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(userAgent) && !(window as Window & { MSStream?: unknown }).MSStream;
}

function detectStandaloneDisplay() {
  return typeof window !== "undefined" &&
    (window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true);
}

export function describePushRegistrationResult(result: PushRegistrationResult) {
  switch (result.status) {
    case "granted":
      return "Notificaciones activadas correctamente.";
    case "denied":
      return "Las notificaciones están bloqueadas. En tu teléfono abre ajustes del navegador, busca spste.com y permite notificaciones.";
    case "default":
      return "Activa las notificaciones para recibir alertas de pedidos, rutas e inventario.";
    case "unsupported":
      return result.reason;
    case "config-unavailable":
      return "El servidor aún no tiene push configurado. Debe desplegarse el backend en Render con las variables Firebase.";
    case "error":
      return result.message;
    default:
      return "No fue posible activar las notificaciones.";
  }
}

export function shouldShowPushBanner(result: PushRegistrationResult | null) {
  return result !== null && result.status !== "granted";
}

async function fetchPushConfig(apiBaseUrl: string) {
  const response = await fetch(`${apiBaseUrl}/push/config`);

  if (!response.ok) {
    return null;
  }

  return response.json() as Promise<PushConfig>;
}

async function ensureFirebaseMessaging(config: PushConfig) {
  const { initializeApp } = await import("firebase/app");
  const { getMessaging, getToken, onMessage } = await import("firebase/messaging");

  if (!firebaseApp) {
    firebaseApp = initializeApp(config);
  }

  if (!messagingClient) {
    messagingClient = getMessaging(firebaseApp);
  }

  if (!foregroundListenerAttached) {
    foregroundListenerAttached = true;
    onMessage(messagingClient, (payload) => {
      const title = payload.notification?.title ?? "SPS";
      const body = payload.notification?.body ?? "";
      const link = payload.data?.link ?? payload.fcmOptions?.link ?? "/";

      if (Notification.permission === "granted") {
        const notification = new Notification(title, {
          body,
          icon: "/icons/icon-192.png",
        });

        notification.onclick = () => {
          window.focus();
          window.location.href = link;
        };
      }
    });
  }

  return { getToken, messaging: messagingClient };
}

export async function registerWebPushNotifications(userId: string, apiBaseUrl: string): Promise<PushRegistrationResult> {
  try {
    if (typeof window === "undefined" || !("Notification" in window)) {
      return {
        status: "unsupported",
        reason: "Este navegador no soporta notificaciones web.",
      };
    }

    if (detectIosSafari() && !detectStandaloneDisplay()) {
      return {
        status: "unsupported",
        reason: "En iPhone debes abrir spste.com en Safari, tocar Compartir → Añadir a pantalla de inicio y entrar desde ese icono (iOS 16.4+).",
      };
    }

    let permission = Notification.permission;

    if (permission === "default") {
      permission = await Notification.requestPermission();
    }

    if (permission === "denied") {
      return { status: "denied" };
    }

    if (permission !== "granted") {
      return { status: "default" };
    }

    const { isSupported } = await import("firebase/messaging");

    if (!(await isSupported())) {
      return {
        status: "unsupported",
        reason: "Este dispositivo no soporta Firebase Cloud Messaging en la web.",
      };
    }

    const config = await fetchPushConfig(apiBaseUrl);

    if (!config) {
      return { status: "config-unavailable" };
    }

    const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
    await navigator.serviceWorker.ready;

    const { getToken, messaging } = await ensureFirebaseMessaging(config);
    const token = await getToken(messaging, {
      vapidKey: config.vapidKey,
      serviceWorkerRegistration: registration,
    });

    if (!token) {
      return {
        status: "error",
        message: "No fue posible obtener el token de notificaciones. Intenta de nuevo.",
      };
    }

    const response = await fetch(`${apiBaseUrl}/push/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, token }),
    });

    if (!response.ok) {
      return {
        status: "error",
        message: "El servidor rechazó el registro de notificaciones.",
      };
    }

    sessionStorage.setItem(PUSH_TOKEN_STORAGE_KEY, token);
    return { status: "granted" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido al activar notificaciones.";
    return { status: "error", message };
  }
}

export async function unregisterWebPushNotifications(userId: string, apiBaseUrl: string) {
  const token = sessionStorage.getItem(PUSH_TOKEN_STORAGE_KEY);

  if (!token) {
    return;
  }

  try {
    await fetch(`${apiBaseUrl}/push/unregister`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, token }),
    });
  } finally {
    sessionStorage.removeItem(PUSH_TOKEN_STORAGE_KEY);
  }
}
