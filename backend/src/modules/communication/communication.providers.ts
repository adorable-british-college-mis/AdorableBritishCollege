import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../../config/env.js";

export type ProviderConfiguration = {
  resendApiKey: string;
  resendFromEmail: string;
  resendWebhookSecret: string;
  twilioAccountSid: string;
  twilioAuthToken: string;
  twilioWhatsAppFrom: string;
  publicUrl: string;
  defaultCountryCallingCode: string;
};

export const providerConfiguration = (): ProviderConfiguration => ({
  resendApiKey: env.RESEND_API_KEY,
  resendFromEmail: env.RESEND_FROM_EMAIL,
  resendWebhookSecret: env.RESEND_WEBHOOK_SECRET,
  twilioAccountSid: env.TWILIO_ACCOUNT_SID,
  twilioAuthToken: env.TWILIO_AUTH_TOKEN,
  twilioWhatsAppFrom: env.TWILIO_WHATSAPP_FROM,
  publicUrl: env.COMMUNICATION_PUBLIC_URL.replace(/\/$/, ""),
  defaultCountryCallingCode: env.DEFAULT_COUNTRY_CALLING_CODE,
});

export function getProviderReadiness(config = providerConfiguration()) {
  return {
    email: {
      configured: Boolean(config.resendApiKey && config.resendFromEmail),
      provider: "Resend",
      webhookConfigured: Boolean(config.resendWebhookSecret),
    },
    whatsapp: {
      configured: Boolean(config.twilioAccountSid && config.twilioAuthToken && config.twilioWhatsAppFrom),
      provider: "Twilio WhatsApp",
      webhookConfigured: Boolean(config.publicUrl),
    },
  };
}

export function normalizePhoneNumber(value: string, defaultCallingCode = env.DEFAULT_COUNTRY_CALLING_CODE) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;
  const normalized = hasPlus ? `+${digits}` : trimmed.startsWith("0") ? `${defaultCallingCode}${digits.slice(1)}` : `+${digits}`;
  return /^\+[1-9]\d{7,14}$/.test(normalized) ? normalized : null;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character] ?? character);
}

function buildSchoolEmailTemplate(input: {
  subject: string;
  body: string;
  recipientName?: string;
}) {
  const subject = escapeHtml(input.subject);
  const recipientName = escapeHtml(
    input.recipientName?.trim() || "Parent/Guardian"
  );

  // Safely convert the plain-text composer message to HTML.
  const message = escapeHtml(input.body)
    .split(/\n{2,}/)
    .map(
      (paragraph) => `
        <p style="margin:0 0 18px 0;">
          ${paragraph.replaceAll("\n", "<br>")}
        </p>
      `
    )
    .join("");

  const year = new Date().getFullYear();

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="x-apple-disable-message-reformatting">
  <title>${subject}</title>
</head>

<body
  style="
    margin:0;
    padding:0;
    background-color:#f4f6f9;
    font-family:Arial,Helvetica,sans-serif;
    color:#172033;
  "
>

  <!-- Hidden inbox preview -->
  <div
    style="
      display:none;
      max-height:0;
      overflow:hidden;
      opacity:0;
      color:transparent;
    "
  >
    ${subject} — Adorable British College
  </div>

  <table
    role="presentation"
    width="100%"
    cellspacing="0"
    cellpadding="0"
    border="0"
    style="width:100%;background-color:#f4f6f9;"
  >
    <tr>
      <td align="center" style="padding:32px 16px;">

        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(18,33,59,0.10);">

          <!-- Header -->
          <tr>
            <td style="padding:36px 40px;background-color:#3b1e78;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td width="52" valign="middle">
                    <div style="width:48px;height:48px;border-radius:50%;border:2px solid #c4a8f0;text-align:center;line-height:48px;">
                      <span style="font-size:18px;font-weight:700;color:#ffffff;letter-spacing:1px;">ABC</span>
                    </div>
                  </td>
                  <td style="padding-left:16px;">
                    <div style="font-size:22px;line-height:28px;font-weight:700;color:#ffffff;">Adorable British College</div>
                    <div style="margin-top:4px;font-size:13px;line-height:18px;color:#d4c2f0;">Official School Communication</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding:36px 40px 28px 40px;">

              <div style="margin-bottom:10px;font-size:11px;line-height:16px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:#7c54b5;">
                School Communication
              </div>

              <h1 style="margin:0 0 24px 0;padding-bottom:20px;border-bottom:1px solid #eceef2;font-size:24px;line-height:32px;font-weight:700;color:#172033;">
                ${subject}
              </h1>

              <p style="margin:0 0 20px 0;font-size:16px;line-height:26px;color:#3a4258;">
                Dear ${recipientName},
              </p>

              <div style="font-size:16px;line-height:26px;color:#3a4258;">
                ${message}
              </div>

              <!-- Help box -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:28px;">
                <tr>
                  <td style="padding:16px 18px;background-color:#f5f3ff;border-left:4px solid #3b1e78;border-radius:8px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td width="28" valign="top">
                          <div style="width:22px;height:22px;border-radius:50%;background-color:#3b1e78;color:#ffffff;text-align:center;font-size:14px;font-weight:700;line-height:22px;">i</div>
                        </td>
                        <td style="padding-left:12px;">
                          <strong style="display:block;margin-bottom:4px;font-size:14px;color:#3b1e78;">Need assistance?</strong>
                          <span style="font-size:13px;line-height:21px;color:#5b5470;">Please contact the school office if you have any questions regarding this communication.</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Signature -->
              <div style="margin-top:28px;font-size:15px;line-height:24px;color:#3a4258;">
                Kind regards,<br>
                <strong style="color:#3b1e78;">Adorable British College</strong>
              </div>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding:22px 40px;background-color:#f9fafb;border-top:1px solid #eceef2;">
              <p style="margin:0 0 5px 0;font-size:12px;line-height:18px;color:#8a92a0;">This email was sent by Adorable British College.</p>
              <p style="margin:0;font-size:12px;line-height:18px;color:#a0a6b2;">This communication may contain information intended only for the recipient.</p>
            </td>
          </tr>

        </table>

        <!-- Copyright -->
        <div
          style="
            max-width:600px;
            padding:18px 20px 0 20px;
            text-align:center;
            font-size:11px;
            line-height:18px;
            color:#979daa;
          "
        >
          © ${year} Adorable British College
        </div>

      </td>
    </tr>
  </table>

</body>
</html>`;
}
export class DeliveryProviderError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
  }
}

type Fetcher = typeof fetch;

export async function sendEmail(
  input: {
    to: string;
    subject: string;
    body: string;
    recipientName?: string;
  },
  config = providerConfiguration(),
  fetcher: Fetcher = fetch
) {
  if (!config.resendApiKey || !config.resendFromEmail) {
    throw new DeliveryProviderError(
      "EMAIL_PROVIDER_NOT_CONFIGURED",
      "Live email delivery is not configured."
    );
  }

  const html = buildSchoolEmailTemplate({
    subject: input.subject,
    body: input.body,
    recipientName: input.recipientName,
  });

  const response = await fetcher("https://api.resend.com/emails", {
    method: "POST",

    headers: {
      Authorization: `Bearer ${config.resendApiKey}`,
      "Content-Type": "application/json",
    },

    body: JSON.stringify({
      from: config.resendFromEmail,
      to: [input.to],
      subject: input.subject,

      // Plain-text fallback
      text: input.body,

      // Branded Adorable British College email
      html,

      tags: [
        {
          name: "source",
          value: "abc_mis",
        },
      ],
    }),
  });

  const payload = (await response.json()) as {
    id?: string;
    message?: string;
    name?: string;
  };

  if (!response.ok || !payload.id) {
    throw new DeliveryProviderError(
      payload.name ?? "EMAIL_PROVIDER_ERROR",
      payload.message ?? "The email provider rejected the message."
    );
  }

  return {
    providerId: payload.id,
  };
}

// export async function sendEmail(input: { to: string; subject: string; body: string }, config = providerConfiguration(), fetcher: Fetcher = fetch) {
//   if (!config.resendApiKey || !config.resendFromEmail) throw new DeliveryProviderError("EMAIL_PROVIDER_NOT_CONFIGURED", "Live email delivery is not configured.");
//   const response = await fetcher("https://api.resend.com/emails", {
//     method: "POST",
//     headers: { Authorization: `Bearer ${config.resendApiKey}`, "Content-Type": "application/json" },
//     body: JSON.stringify({
//       from: config.resendFromEmail,
//       to: [input.to],
//       subject: input.subject,
//       text: input.body,
//       html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#12213b">${escapeHtml(input.body).replaceAll("\n", "<br>")}</div>`,
//       tags: [{ name: "source", value: "abc_mis" }],
//     }),
//   });
//   const payload = await response.json() as { id?: string; message?: string; name?: string };
//   if (!response.ok || !payload.id) throw new DeliveryProviderError(payload.name ?? "EMAIL_PROVIDER_ERROR", payload.message ?? "The email provider rejected the message.");
//   return { providerId: payload.id };
// }

export async function sendWhatsApp(input: { to: string; body: string }, config = providerConfiguration(), fetcher: Fetcher = fetch) {
  if (!config.twilioAccountSid || !config.twilioAuthToken || !config.twilioWhatsAppFrom) throw new DeliveryProviderError("WHATSAPP_PROVIDER_NOT_CONFIGURED", "Live WhatsApp delivery is not configured.");
  const to = normalizePhoneNumber(input.to, config.defaultCountryCallingCode);
  const from = normalizePhoneNumber(config.twilioWhatsAppFrom, config.defaultCountryCallingCode);
  if (!to) throw new DeliveryProviderError("INVALID_WHATSAPP_NUMBER", "The guardian phone number is not a valid international number.");
  if (!from) throw new DeliveryProviderError("INVALID_WHATSAPP_SENDER", "The configured WhatsApp sender number is invalid.");
  const form = new URLSearchParams({ From: `whatsapp:${from}`, To: `whatsapp:${to}`, Body: input.body });
  if (config.publicUrl) form.set("StatusCallback", `${config.publicUrl}/api/v1/communication/webhooks/twilio/status`);
  const response = await fetcher(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(config.twilioAccountSid)}/Messages.json`, {
    method: "POST",
    headers: { Authorization: `Basic ${Buffer.from(`${config.twilioAccountSid}:${config.twilioAuthToken}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
  const payload = await response.json() as { sid?: string; status?: string; code?: number; message?: string };
  if (!response.ok || !payload.sid) throw new DeliveryProviderError(String(payload.code ?? "WHATSAPP_PROVIDER_ERROR"), payload.message ?? "The WhatsApp provider rejected the message.");
  return { providerId: payload.sid, providerStatus: payload.status ?? "queued", destination: to };
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function verifyTwilioSignature(url: string, params: Record<string, unknown>, signature: string, config = providerConfiguration()) {
  if (!config.twilioAuthToken || !signature) return false;
  const content = Object.keys(params).sort().reduce((value, key) => `${value}${key}${String(params[key] ?? "")}`, url);
  const expected = createHmac("sha1", config.twilioAuthToken).update(content).digest("base64");
  return safeEqual(expected, signature);
}

export function verifyResendSignature(payload: string, headers: { id?: string; timestamp?: string; signature?: string }, config = providerConfiguration()) {
  if (!config.resendWebhookSecret || !headers.id || !headers.timestamp || !headers.signature) return false;
  const timestamp = Number(headers.timestamp);
  if (!Number.isFinite(timestamp) || Math.abs(Date.now() / 1000 - timestamp) > 300) return false;
  const secret = config.resendWebhookSecret.startsWith("whsec_") ? config.resendWebhookSecret.slice(6) : config.resendWebhookSecret;
  let key: Buffer;
  try { key = Buffer.from(secret, "base64"); } catch { return false; }
  const expected = createHmac("sha256", key).update(`${headers.id}.${headers.timestamp}.${payload}`).digest("base64");
  return headers.signature.split(" ").some((candidate) => candidate.startsWith("v1,") && safeEqual(expected, candidate.slice(3)));
}
