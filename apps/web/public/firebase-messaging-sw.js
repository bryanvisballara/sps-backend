/* Firebase Cloud Messaging service worker for SPS */
/* global importScripts, firebase, clients */

try {
  importScripts("/firebase-config.js");
  importScripts("https://www.gstatic.com/firebasejs/12.15.0/firebase-app-compat.js");
  importScripts("https://www.gstatic.com/firebasejs/12.15.0/firebase-messaging-compat.js");

  var config = self.__FIREBASE_CONFIG__ || null;
  var hasValidConfig = Boolean(
    config
    && typeof config === "object"
    && config.apiKey
    && config.appId
    && config.projectId
    && config.messagingSenderId
  );

  if (!hasValidConfig) {
    console.error("[SPS push] firebase-config.js is missing apiKey/appId. Service worker loaded without messaging.");
  } else {
    firebase.initializeApp(config);
    var messaging = firebase.messaging();

    messaging.onBackgroundMessage(function (payload) {
      var data = (payload && payload.data) || {};
      var notification = (payload && payload.notification) || {};
      var fcmOptions = (payload && payload.fcmOptions) || {};
      var title = data.title || notification.title || "SPS";
      var body = data.body || notification.body || "";
      var link = data.link || fcmOptions.link || "/";

      return self.registration.showNotification(title, {
        body: body,
        icon: "/icons/icon-192.png",
        data: { link: link },
        tag: (payload && payload.messageId) || data.tag || "sps-push",
        renotify: false,
      });
    });

    self.addEventListener("notificationclick", function (event) {
      event.notification.close();
      var link = (event.notification.data && event.notification.data.link) || "/";
      event.waitUntil(clients.openWindow(link));
    });
  }
} catch (error) {
  console.error("[SPS push] Service worker failed to initialize:", error);
}
