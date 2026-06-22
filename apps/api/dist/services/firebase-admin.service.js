import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import { env } from "../config/env.js";
let firebaseApp = null;
let messagingClient = null;
function resolvePrivateKey(value) {
    return value.replace(/\\n/g, "\n");
}
export function isFirebasePushConfigured() {
    return Boolean(env.FIREBASE_PROJECT_ID?.trim() &&
        env.FIREBASE_CLIENT_EMAIL?.trim() &&
        env.FIREBASE_PRIVATE_KEY?.trim());
}
export function getFirebaseMessaging() {
    if (!isFirebasePushConfigured()) {
        return null;
    }
    if (!firebaseApp) {
        const existingApp = getApps()[0];
        firebaseApp = existingApp ?? initializeApp({
            credential: cert({
                projectId: env.FIREBASE_PROJECT_ID.trim(),
                clientEmail: env.FIREBASE_CLIENT_EMAIL.trim(),
                privateKey: resolvePrivateKey(env.FIREBASE_PRIVATE_KEY.trim()),
            }),
        });
    }
    if (!messagingClient) {
        messagingClient = getMessaging(firebaseApp);
    }
    return messagingClient;
}
//# sourceMappingURL=firebase-admin.service.js.map