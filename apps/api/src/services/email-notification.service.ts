import { User } from "../modules/users/user.model.js";

type EmailPayload = {
  subject: string;
  text: string;
  html?: string;
};

function isDeliverableEmail(email: string) {
  const normalized = email.trim().toLowerCase();

  if (!normalized.includes("@")) {
    return false;
  }

  return !normalized.endsWith("@sps.local");
}

export function isEmailNotificationConfigured() {
  return Boolean(process.env.RESEND_API_KEY?.trim() && process.env.EMAIL_FROM?.trim());
}

export async function sendEmailToRoles(roles: string[], payload: EmailPayload) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();

  if (!apiKey || !from) {
    return { sent: 0, skipped: true };
  }

  const users = await User.find({ role: { $in: roles }, active: { $ne: false } })
    .select({ email: 1 })
    .lean();

  const recipients = [...new Set(
    users
      .map((user) => String(user.email ?? "").trim())
      .filter(isDeliverableEmail),
  )];

  if (recipients.length === 0) {
    return { sent: 0, skipped: false };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: recipients,
        subject: payload.subject,
        text: payload.text,
        html: payload.html ?? payload.text.replace(/\n/g, "<br />"),
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("Email send failed", { status: response.status, errorBody });
      return { sent: 0, skipped: false, failed: true };
    }

    return { sent: recipients.length, skipped: false };
  } catch (error) {
    console.error("Email send failed", error);
    return { sent: 0, skipped: false, failed: true };
  }
}
