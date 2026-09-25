import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { normalizePhoneNumber, sendEmail, sendWhatsApp, verifyResendSignature, verifyTwilioSignature, type ProviderConfiguration } from "./communication.providers.js";

const config: ProviderConfiguration = {
  resendApiKey: "re_test_key",
  resendFromEmail: "ABC <school@example.com>",
  resendWebhookSecret: `whsec_${Buffer.from("resend-secret").toString("base64")}`,
  twilioAccountSid: "AC123",
  twilioAuthToken: "twilio-secret",
  twilioWhatsAppFrom: "+14155238886",
  publicUrl: "https://school.example.com",
  defaultCountryCallingCode: "+234",
};

describe("live communication providers", () => {
  it("normalises Nigerian guardian numbers to E.164", () => {
    expect(normalizePhoneNumber("0801 234 5678", "+234")).toBe("+2348012345678");
    expect(normalizePhoneNumber("+234-801-234-5678", "+234")).toBe("+2348012345678");
    expect(normalizePhoneNumber("invalid", "+234")).toBeNull();
  });

  it("submits live email payloads to Resend", async () => {
    const fetcher = vi.fn(async (_input: string | URL | Request, _init?: RequestInit) => new Response(JSON.stringify({ id: "email_123" }), { status: 200, headers: { "content-type": "application/json" } }));
    await expect(sendEmail({ to: "parent@example.com", subject: "School update", body: "Hello parent" }, config, fetcher)).resolves.toEqual({ providerId: "email_123" });
    expect(fetcher).toHaveBeenCalledWith("https://api.resend.com/emails", expect.objectContaining({ method: "POST" }));
    const body = JSON.parse(String(fetcher.mock.calls[0]![1]?.body));
    expect(body).toMatchObject({ to: ["parent@example.com"], subject: "School update", text: "Hello parent" });
  });

  it("submits WhatsApp messages and a signed status callback to Twilio", async () => {
    const fetcher = vi.fn(async (_input: string | URL | Request, _init?: RequestInit) => new Response(JSON.stringify({ sid: "SM123", status: "queued" }), { status: 201, headers: { "content-type": "application/json" } }));
    await expect(sendWhatsApp({ to: "08012345678", body: "Attendance update" }, config, fetcher)).resolves.toMatchObject({ providerId: "SM123", destination: "+2348012345678" });
    const [, request] = fetcher.mock.calls[0]!;
    const form = new URLSearchParams(String(request?.body));
    expect(form.get("To")).toBe("whatsapp:+2348012345678");
    expect(form.get("StatusCallback")).toBe("https://school.example.com/api/v1/communication/webhooks/twilio/status");
  });

  it("verifies Twilio and Resend webhook signatures", () => {
    const twilioUrl = "https://school.example.com/api/v1/communication/webhooks/twilio/status";
    const twilioParams = { MessageSid: "SM123", MessageStatus: "delivered" };
    const twilioContent = `${twilioUrl}MessageSidSM123MessageStatusdelivered`;
    const twilioSignature = createHmac("sha1", config.twilioAuthToken).update(twilioContent).digest("base64");
    expect(verifyTwilioSignature(twilioUrl, twilioParams, twilioSignature, config)).toBe(true);

    const payload = JSON.stringify({ type: "email.delivered", data: { email_id: "email_123" } });
    const headers = { id: "msg_123", timestamp: String(Math.floor(Date.now() / 1000)), signature: "" };
    headers.signature = `v1,${createHmac("sha256", Buffer.from(config.resendWebhookSecret.slice(6), "base64")).update(`${headers.id}.${headers.timestamp}.${payload}`).digest("base64")}`;
    expect(verifyResendSignature(payload, headers, config)).toBe(true);
  });
});
