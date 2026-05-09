// @ts-nocheck — Deno runtime; Node/TS type checker does not apply here

import nodemailer from "npm:nodemailer@6";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-snoozeguard-secret",
};

interface Payload {
  driverName: string;
  contactEmail?: string | null;
  contactPhone?: string | null;
  token: string;
}

// ─── Email ─────────────────────────────────────────────────────────────────────

function buildEmailHtml(driverName: string, acceptLink: string, declineLink: string, appDeepLink: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f0f0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f0f;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:460px;background:#1a1a1a;border-radius:20px;overflow:hidden;border:1px solid #2a2a2a;">

        <!-- Header -->
        <tr>
          <td style="background:#1e3a5f;padding:28px 32px;text-align:center;">
            <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
              <tr>
                <td style="background:rgba(255,255,255,0.15);border-radius:8px;padding:6px 12px;vertical-align:middle;">
                  <span style="color:white;font-weight:900;font-size:12px;letter-spacing:-0.5px;">SG</span>
                </td>
                <td style="padding-left:10px;vertical-align:middle;">
                  <span style="color:white;font-weight:900;font-size:12px;letter-spacing:3px;">SNOOZEGUARD</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px 32px 24px;">
            <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#7bb8ff;letter-spacing:2px;text-transform:uppercase;">Emergency Guardian Request</p>
            <h1 style="margin:0 0 20px;font-size:22px;font-weight:800;color:#ffffff;line-height:1.3;">
              ${driverName} wants you as their guardian
            </h1>
            <p style="margin:0 0 20px;font-size:14px;color:#aaa;line-height:1.7;">
              If you accept, you'll receive an <strong style="color:#fff;">SMS alert</strong> whenever
              ${driverName} shows critical signs of drowsiness during a drive and doesn't respond in time.
            </p>
            <p style="margin:0 0 28px;font-size:13px;color:#666;line-height:1.6;">
              You do <strong>not</strong> need to create an account to accept or decline.
            </p>

            <!-- Accept CTA -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;">
              <tr>
                <td align="center">
                  <a href="${acceptLink}"
                    style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;
                           padding:15px 44px;border-radius:12px;font-weight:800;font-size:15px;
                           letter-spacing:0.3px;">
                    ✓ &nbsp;Accept Request
                  </a>
                </td>
              </tr>
            </table>

            <!-- Decline link -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
              <tr>
                <td align="center">
                  <a href="${declineLink}"
                    style="display:inline-block;color:#555;text-decoration:underline;
                           padding:10px 28px;font-size:13px;">
                    No thanks, decline
                  </a>
                </td>
              </tr>
            </table>

            <!-- Divider -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
              <tr><td style="border-top:1px solid #2a2a2a;"></td></tr>
            </table>

            <!-- App deep link for SnoozeGuard users -->
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center">
                  <p style="margin:0 0 8px;color:#444;font-size:11px;">Have the SnoozeGuard app installed?</p>
                  <a href="${appDeepLink}"
                    style="display:inline-block;color:#7bb8ff;text-decoration:none;
                           padding:8px 20px;border:1px solid #2a4a6e;border-radius:8px;font-size:12px;font-weight:600;">
                    📱  Open in SnoozeGuard app
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#111;padding:20px 32px;border-top:1px solid #222;">
            <p style="margin:0;color:#444;font-size:11px;text-align:center;line-height:1.6;">
              This link expires in 7 days. If you weren't expecting this, you can safely ignore it.<br>
              SnoozeGuard — Driver Safety System
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

async function sendEmail(
  to: string,
  driverName: string,
  acceptLink: string,
  declineLink: string,
  appDeepLink: string,
): Promise<{ sent: boolean; error?: string }> {
  const gmailUser = Deno.env.get("GMAIL_USER");
  const gmailPass = Deno.env.get("GMAIL_APP_PASSWORD");
  if (!gmailUser || !gmailPass) return { sent: false, error: "GMAIL_USER or GMAIL_APP_PASSWORD not set" };

  try {
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: { user: gmailUser, pass: gmailPass },
    });

    await transporter.sendMail({
      from: `"SnoozeGuard" <${gmailUser}>`,
      to,
      subject: `${driverName} wants you as their emergency guardian`,
      html: buildEmailHtml(driverName, acceptLink, declineLink, appDeepLink),
      text: `${driverName} wants to add you as their emergency guardian on SnoozeGuard.\n\nAccept: ${acceptLink}\nDecline: ${declineLink}\n\nThis link expires in 7 days.`,
    });

    return { sent: true };
  } catch (e) {
    return { sent: false, error: String(e) };
  }
}

// ─── SMS ──────────────────────────────────────────────────────────────────────

function normalizePhone(phone: string): string {
  const stripped = phone.trim().replace(/[\s\-().+]/g, "");
  return stripped.startsWith("09") ? "63" + stripped.slice(1) : stripped;
}

async function sendSms(
  phone: string,
  driverName: string,
  link: string,
): Promise<{ sent: boolean; provider: string }> {
  const normalized = normalizePhone(phone);
  const message =
    `SnoozeGuard: ${driverName} wants you as their emergency guardian. Tap to respond: ${link}`;

  console.log("[SMS] Sending to", normalized.slice(0, 6) + "***");

  // Try TextBelt first (matches dynamic-worker order)
  const textbeltKey = Deno.env.get("TEXTBELT_KEY") ?? "textbelt";
  console.log("[SMS] Trying TextBelt, key:", textbeltKey === "textbelt" ? "free" : "paid");
  try {
    const res = await fetch("https://textbelt.com/text", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: normalized, message, key: textbeltKey }),
    });
    const json = await res.json() as { success?: boolean; error?: string; quotaRemaining?: number };
    console.log("[SMS] TextBelt response:", JSON.stringify(json));
    if (json.success === true) return { sent: true, provider: "textbelt" };
  } catch (e) {
    console.error("[SMS] TextBelt error:", e);
  }

  // Try PhilSMS as fallback
  const philToken = Deno.env.get("PHILSMS_TOKEN");
  const philSender = Deno.env.get("PHILSMS_SENDER") ?? "PhilSMS";
  console.log("[SMS] Trying PhilSMS, token set:", !!philToken, "sender:", philSender);
  if (philToken) {
    try {
      const res = await fetch("https://dashboard.philsms.com/api/v3/sms/send", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${philToken}`,
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify({
          recipient: normalized,
          sender_id: philSender,
          type: "plain",
          message,
        }),
      });
      const body = await res.text();
      console.log("[SMS] PhilSMS HTTP", res.status, body);
      if (res.ok) return { sent: true, provider: "philsms" };
    } catch (e) {
      console.error("[SMS] PhilSMS error:", e);
    }
  }

  console.log("[SMS] All providers failed");
  return { sent: false, provider: "none" };
}

// ─── Handler ──────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const secret = req.headers.get("x-snoozeguard-secret");
  const expectedSecret = Deno.env.get("SMS_FUNCTION_SECRET");
  if (!expectedSecret || secret !== expectedSecret) {
    return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { driverName, contactEmail, contactPhone, token } = await req.json() as Payload;

    if (!token) {
      return new Response(JSON.stringify({ ok: false, error: "token is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const appUrl = Deno.env.get("APP_URL") ?? "https://snoozeguard.app";
    // Email: two separate links for Accept / Decline
    const acceptLink  = `${appUrl}/accept-guardian?token=${token}&action=accept`;
    const declineLink = `${appUrl}/accept-guardian?token=${token}&action=decline`;
    // SMS: no pre-set action — the page shows both buttons (single link is shorter)
    const smsLink = `${appUrl}/accept-guardian?token=${token}`;
    // Deep link for SnoozeGuard app users (included in email only)
    const appDeepLink = `snoozeguard://accept-guardian?token=${token}`;

    const results: Record<string, unknown> = {};

    if (contactEmail) {
      const emailResult = await sendEmail(contactEmail, driverName, acceptLink, declineLink, appDeepLink);
      results.email = emailResult;
      console.log("[notify-guardian] Email to", contactEmail.slice(0, 4) + "***:", emailResult);
    }

    if (contactPhone) {
      const smsResult = await sendSms(contactPhone, driverName, smsLink);
      results.sms = smsResult;
      console.log("[notify-guardian] SMS to", contactPhone.slice(0, 4) + "***:", smsResult);
    }

    return new Response(JSON.stringify({ ok: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[notify-guardian] Error:", err);
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
