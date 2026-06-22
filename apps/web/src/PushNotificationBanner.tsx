import type { PushRegistrationResult } from "./pushNotifications";
import { describePushRegistrationResult } from "./pushNotifications";

type PushNotificationBannerProps = {
  status: PushRegistrationResult | null;
  busy: boolean;
  onEnable: () => void;
  onDismiss: () => void;
};

export function PushNotificationBanner({ status, busy, onEnable, onDismiss }: PushNotificationBannerProps) {
  if (!status || status.status === "granted") {
    return null;
  }

  const canRetry = status.status === "default" || status.status === "error" || status.status === "config-unavailable";

  return (
    <article className="push-notification-banner">
      <div>
        <p className="section-label">Notificaciones</p>
        <p>{describePushRegistrationResult(status)}</p>
      </div>
      <div className="push-notification-banner-actions">
        {canRetry ? (
          <button className="primary-button" type="button" disabled={busy} onClick={onEnable}>
            {busy ? "Activando..." : "Activar notificaciones"}
          </button>
        ) : null}
        <button className="ghost-button" type="button" onClick={onDismiss}>
          Ocultar
        </button>
      </div>
    </article>
  );
}
