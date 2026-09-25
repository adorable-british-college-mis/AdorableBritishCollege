# Live Communications Setup

The Communication module sends real email through Resend and real WhatsApp messages through Twilio. Credentials remain in `backend/.env` and are never sent to the browser.

## Twilio WhatsApp

Set these values in `backend/.env`:

```dotenv
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_WHATSAPP_FROM=+14155550123
COMMUNICATION_PUBLIC_URL=https://api.your-school-domain.example
DEFAULT_COUNTRY_CALLING_CODE=+234
```

`TWILIO_WHATSAPP_FROM` must be the number shown in the Twilio WhatsApp Sandbox or an approved production WhatsApp sender. Do not use the API key SID as the Account SID or Auth Token.

In the Twilio WhatsApp sender configuration, set **When a message comes in** to:

```text
https://api.your-school-domain.example/api/v1/communication/webhooks/twilio/incoming
```

Use `HTTP POST`. Delivery status callbacks are attached automatically to outgoing messages. Twilio requires the public callback URL to use a valid reachable HTTPS endpoint for production.

For sandbox testing, the destination phone must first join the Twilio sandbox using the join instruction displayed in the Twilio console. Outside an active WhatsApp customer-service window, production-initiated messages require an approved WhatsApp content template.

## Resend Email

Set these values in `backend/.env`:

```dotenv
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=Adorable British College <communications@your-school-domain.example>
RESEND_WEBHOOK_SECRET=whsec_...
```

Verify the sender domain in Resend. Create a webhook pointing to:

```text
https://api.your-school-domain.example/api/v1/communication/webhooks/resend
```

Subscribe to `email.sent`, `email.delivered`, `email.bounced`, `email.complained`, and `email.failed` events.

## Test

1. Restart the backend after changing environment variables.
2. Open **Communication** and confirm the provider indicators show ready.
3. Ensure the test guardian has a valid email and E.164-compatible phone number.
4. Use **WhatsApp Parent** or **Compose Email**, select only the consenting test guardian, and send a test message.
5. Confirm the message status changes from sent to delivered after the signed provider webhook arrives.

Never commit `.env`, paste provider secrets into frontend code, or use a real parent for an initial provider test without their consent.
