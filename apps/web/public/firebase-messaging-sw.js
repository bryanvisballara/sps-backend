importScripts("/firebase-config.js");
importScripts("https://www.gstatic.com/firebasejs/12.15.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.15.0/firebase-messaging-compat.js");

if (self.__FIREBASE_CONFIG__) {
  firebase.initializeApp(self.__FIREBASE_CONFIG__);
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    const title = payload.notification?.title ?? "SPS";
    const body = payload.notification?.body ?? "";
    const link = payload.fcmOptions?.link ?? "/";

    self.registration.showNotification(title, {
      body,
      icon: "/icons/icon-192.png",
      data: { link },
    });
  });

  self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    const link = event.notification.data?.link ?? "/";
    event.waitUntil(clients.openWindow(link));
  });
}
