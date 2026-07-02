import { PushNotificationLog } from "../modules/notifications/push-notification-log.model.js";
import { PushToken } from "../modules/notifications/push-token.model.js";
import { User } from "../modules/users/user.model.js";
import { sendEmailToRoles } from "./email-notification.service.js";
import { getFirebaseMessaging, isFirebasePushConfigured } from "./firebase-admin.service.js";

const TEN_YEARS_MS = 10 * 365.25 * 24 * 60 * 60 * 1000;

type PushPayload = {
  title: string;
  body: string;
  url?: string;
};

async function findActiveTokensForRoles(roles: string[]) {
  const users = await User.find({ role: { $in: roles }, active: { $ne: false } }).select({ _id: 1 }).lean();
  const userIds = users.map((user) => String(user._id));

  if (userIds.length === 0) {
    return [];
  }

  return PushToken.find({
    userId: { $in: userIds },
    active: true,
    expiresAt: { $gt: new Date() },
  }).lean();
}

async function findActiveTokensForUser(userId: string) {
  return PushToken.find({
    userId,
    active: true,
    expiresAt: { $gt: new Date() },
  }).lean();
}

async function deactivateInvalidTokens(tokens: string[]) {
  if (tokens.length === 0) {
    return;
  }

  await PushToken.updateMany({ fcmToken: { $in: tokens } }, { active: false });
}

export async function registerPushToken(userId: string, fcmToken: string) {
  const normalizedToken = fcmToken.trim();
  const normalizedUserId = userId.trim();

  if (!normalizedToken || !normalizedUserId) {
    throw new Error("Usuario y token son obligatorios.");
  }

  const user = await User.findById(normalizedUserId).lean();

  if (!user || user.active === false) {
    throw new Error("El usuario no existe o no esta activo.");
  }

  const expiresAt = new Date(Date.now() + TEN_YEARS_MS);

  await PushToken.findOneAndUpdate(
    { fcmToken: normalizedToken },
    { userId: normalizedUserId, fcmToken: normalizedToken, expiresAt, active: true },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  return { expiresAt };
}

export async function unregisterPushToken(userId: string, fcmToken: string) {
  await PushToken.updateMany(
    { userId: userId.trim(), fcmToken: fcmToken.trim() },
    { active: false },
  );
}

export async function sendPushToRoles(roles: string[], payload: PushPayload) {
  if (!isFirebasePushConfigured()) {
    return { sent: 0, skipped: true };
  }

  const messaging = getFirebaseMessaging();

  if (!messaging) {
    return { sent: 0, skipped: true };
  }

  const tokenRows = await findActiveTokensForRoles(roles);
  const tokens = [...new Set(tokenRows.map((row) => row.fcmToken))];

  if (tokens.length === 0) {
    return { sent: 0, skipped: false };
  }

  return sendPushToTokens(messaging, tokens, payload);
}

export async function sendPushToUser(userId: string, payload: PushPayload) {
  if (!isFirebasePushConfigured()) {
    return { sent: 0, skipped: true };
  }

  const messaging = getFirebaseMessaging();

  if (!messaging) {
    return { sent: 0, skipped: true };
  }

  const tokenRows = await findActiveTokensForUser(userId);
  const tokens = [...new Set(tokenRows.map((row) => row.fcmToken))];

  if (tokens.length === 0) {
    return { sent: 0, skipped: false };
  }

  return sendPushToTokens(messaging, tokens, payload);
}

async function sendPushToTokens(
  messaging: NonNullable<ReturnType<typeof getFirebaseMessaging>>,
  tokens: string[],
  payload: PushPayload,
) {
  const invalidTokens: string[] = [];
  let sent = 0;

  await Promise.all(tokens.map(async (token) => {
    try {
      const link = payload.url ?? "/";

      // Data-only payload: the web client shows one notification via onMessage / onBackgroundMessage.
      // Including a top-level or webpush.notification field causes duplicate system notifications.
      await messaging.send({
        token,
        data: {
          title: payload.title,
          body: payload.body,
          link,
        },
        webpush: {
          fcmOptions: { link },
        },
      });
      sent += 1;
    } catch (error) {
      const code = typeof error === "object" && error !== null && "code" in error
        ? String((error as { code?: string }).code ?? "")
        : "";

      if (code.includes("registration-token-not-registered") || code.includes("invalid-argument")) {
        invalidTokens.push(token);
      }

      console.error("Push send failed", { token: `${token.slice(0, 12)}...`, code, error });
    }
  }));

  await deactivateInvalidTokens(invalidTokens);

  return { sent, skipped: false };
}

export async function notifyNewSalesOrder(order: {
  storeName?: string;
  salesRepName?: string;
  _id?: unknown;
}) {
  const storeName = String(order.storeName ?? "cliente");
  const salesRepName = String(order.salesRepName ?? "vendedor");

  await sendPushToRoles(["warehouse-aruba"], {
    title: "Nuevo pedido de bodega",
    body: `${salesRepName} envio un pedido para ${storeName}.`,
    url: "/",
  });
}

export async function notifyContabilidadOrderDispatched(order: {
  storeName?: string;
  salesRepName?: string;
  routeName?: string;
  invoiceNumber?: number | null;
  _id?: unknown;
}) {
  const storeName = String(order.storeName ?? "cliente");
  const salesRepName = String(order.salesRepName ?? "vendedor");
  const routeName = String(order.routeName ?? "").trim();
  const invoiceNumber = Number(order.invoiceNumber ?? 0) || null;
  const invoiceLabel = invoiceNumber ? `Factura ${invoiceNumber}` : "Pedido en despacho";
  const routeSuffix = routeName ? ` · Ruta ${routeName}` : "";
  const body = `El pedido de ${storeName} (${invoiceLabel}) salio a despacho${routeSuffix}. Enviado por bodega para ${salesRepName}.`;
  const emailText = `${body}\n\nRevisa el portal de Contabilidad en la seccion Despacho para facturarlo al confirmar la entrega.`;

  await Promise.all([
    sendPushToRoles(["contabilidad"], {
      title: "Pedido en despacho",
      body,
      url: "/",
    }),
    sendEmailToRoles(["contabilidad"], {
      subject: `Pedido en despacho · ${storeName}`,
      text: emailText,
      html: `<p>${body}</p><p>Revisa el portal de <strong>Contabilidad</strong> en la seccion <strong>Despacho</strong> para facturarlo al confirmar la entrega.</p>`,
    }),
  ]);
}

export async function notifyRouteAssigned(route: {
  salesRepId?: string;
  salesRepName?: string;
  name?: string;
  weekLabel?: string;
}) {
  const salesRepId = String(route.salesRepId ?? "").trim();

  if (!salesRepId) {
    return;
  }

  await sendPushToUser(salesRepId, {
    title: "Ruta asignada",
    body: `Se te asigno la ruta ${String(route.name ?? "")} (${String(route.weekLabel ?? "")}).`,
    url: "/",
  });
}

export async function notifyInventoryAlert(productName: string, sku: string, quantity: number, alertLevel: number) {
  const body = `${productName} (${sku}): quedan ${quantity} unidades (alerta: ${alertLevel}).`;

  await sendPushToRoles(["warehouse-aruba", "management"], {
    title: "Alerta de inventario",
    body,
    url: "/",
  });
}

export async function notifyExpiryThreshold(
  thresholdDays: 60 | 30 | 15,
  productName: string,
  sku: string,
  expirationDate: Date,
) {
  const label = thresholdDays === 60 ? "2 meses" : thresholdDays === 30 ? "1 mes" : "15 dias";
  const formattedDate = expirationDate.toLocaleDateString("es-ES");
  const body = `${productName} (${sku}) vence el ${formattedDate}. Tienes ${label} para venderlo.`;

  await sendPushToRoles(["sales-rep-aruba", "warehouse-aruba", "management"], {
    title: "Producto proximo a vencer",
    body,
    url: "/",
  });
}

export async function sendDedupedNotification(key: string, kind: string, send: () => Promise<void>) {
  const existing = await PushNotificationLog.findOne({ key }).lean();

  if (existing) {
    return false;
  }

  await send();
  await PushNotificationLog.create({ key, kind, sentAt: new Date() });
  return true;
}

export async function clearNotificationLog(key: string) {
  await PushNotificationLog.deleteOne({ key });
}
