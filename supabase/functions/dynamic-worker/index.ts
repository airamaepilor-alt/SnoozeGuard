// @ts-nocheck — Deno runtime; Node/TS type checker does not apply here

import nodemailer from "npm:nodemailer@6";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-snoozeguard-secret",
};

interface AlertPayload {
  phone?: string | null;
  contactEmail?: string | null;
  alertId?: string | null;
  driverName: string;
  lat?: number | null;
  lng?: number | null;
}

// ─── SMS ──────────────────────────────────────────────────────────────────────

function buildSmsMessage(driverName: string, alertViewLink?: string | null): string {
  const viewPart = alertViewLink ? ` Track live: ${alertViewLink}` : "";
  return `URGENT — SnoozeGuard Alert: ${driverName} triggered a critical drowsiness alert. Please check on them immediately.${viewPart}`;
}

async function trySendTextBelt(phone: string, message: string): Promise<boolean> {
  const key = Deno.env.get("TEXTBELT_KEY") || "textbelt";
  try {
    const res = await fetch("https://textbelt.com/text", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, message, key }),
    });
    const json = await res.json() as { success?: boolean };
    return json.success === true;
  } catch {
    return false;
  }
}

async function trySendPhilSms(phone: string, message: string): Promise<boolean> {
  const token = Deno.env.get("PHILSMS_TOKEN");
  const sender = Deno.env.get("PHILSMS_SENDER") || "PhilSMS";
  if (!token) return false;
  try {
    const res = await fetch("https://dashboard.philsms.com/api/v3/sms/send", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({ recipient: phone, sender_id: sender, type: "plain", message }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ─── Email ────────────────────────────────────────────────────────────────────

function buildAlertEmailHtml(
  driverName: string,
  mapsLink: string | null,
  alertViewLink: string,
  alertTime: string,
): string {
  const locationSection = mapsLink
    ? `<a href="${mapsLink}" style="display:inline-block;margin:0 0 20px;background:#1e3a5f;color:#7bb8ff;text-decoration:none;padding:10px 20px;border-radius:10px;font-size:13px;font-weight:700;">📍 View on Google Maps</a>`
    : `<p style="margin:0 0 20px;font-size:13px;color:#666;">Location unavailable at time of alert.</p>`;

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f0f0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f0f;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:460px;background:#1a1a1a;border-radius:20px;overflow:hidden;border:1px solid #2a2a2a;">

        <!-- Header -->
        <tr>
          <td style="background:#7f1d1d;padding:28px 32px;text-align:center;">
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
          <td style="padding:32px 32px 24px;text-align:center;">
            <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#f87171;letter-spacing:2px;text-transform:uppercase;">🚨 Emergency Alert</p>
            <h1 style="margin:0 0 12px;font-size:22px;font-weight:800;color:#ffffff;line-height:1.3;">
              ${driverName} needs you
            </h1>
            <p style="margin:0 0 8px;font-size:13px;color:#aaa;">
              Alert triggered at <strong style="color:#fff;">${alertTime}</strong>
            </p>
            <p style="margin:0 0 24px;font-size:14px;color:#aaa;line-height:1.7;">
              ${driverName} triggered a critical drowsiness alert and did not respond in time.
              Please check on them immediately.
            </p>

            ${locationSection}

            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;">
              <tr>
                <td align="center">
                  <a href="${alertViewLink}"
                    style="display:inline-block;background:#dc2626;color:#ffffff;text-decoration:none;
                           padding:15px 44px;border-radius:12px;font-weight:800;font-size:15px;">
                    🗺️ &nbsp;View Live Alert
                  </a>
                </td>
              </tr>
            </table>

            <p style="margin:16px 0 0;font-size:11px;color:#444;">
              This is an automated emergency alert from SnoozeGuard.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#111;padding:20px 32px;border-top:1px solid #222;">
            <p style="margin:0;color:#444;font-size:11px;text-align:center;line-height:1.6;">
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

async function sendAlertEmail(
  to: string,
  driverName: string,
  lat: number | null | undefined,
  lng: number | null | undefined,
  alertViewLink: string,
): Promise<{ sent: boolean; error?: string }> {
  const gmailUser = Deno.env.get("GMAIL_USER");
  const gmailPass = Deno.env.get("GMAIL_APP_PASSWORD");
  if (!gmailUser || !gmailPass) return { sent: false, error: "GMAIL credentials not set" };

  const mapsLink = lat != null && lng != null
    ? `https://maps.google.com/?q=${lat.toFixed(6)},${lng.toFixed(6)}`
    : null;
  const alertTime = new Date().toLocaleString("en-PH", { timeZone: "Asia/Manila" });
  const html = buildAlertEmailHtml(driverName, mapsLink, alertViewLink, alertTime);

  try {
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: { user: gmailUser, pass: gmailPass },
    });
    await transporter.sendMail({
      from: `"SnoozeGuard Alert" <${gmailUser}>`,
      to,
      subject: `🚨 URGENT: ${driverName} triggered a drowsiness alert`,
      html,
      text: `URGENT — ${driverName} triggered a critical drowsiness alert.\n\n${mapsLink ? `Location: ${mapsLink}\n\n` : ""}View live alert: ${alertViewLink}\n\nSnoozeGuard — Driver Safety System`,
    });
    return { sent: true };
  } catch (e) {
    return { sent: false, error: String(e) };
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const secret = req.headers.get("x-snoozeguard-secret");
    const expectedSecret = Deno.env.get("SMS_FUNCTION_SECRET");
    if (!expectedSecret || secret !== expectedSecret) {
      return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload: AlertPayload = await req.json();
    const { phone, contactEmail, alertId, driverName, lat, lng } = payload;

    const results: Record<string, unknown> = {};

    const appUrl = Deno.env.get("APP_URL") ?? "https://snoozeguard.app";
    const alertViewLink = alertId ? `${appUrl}/alert-view?id=${alertId}` : null;

    // ── SMS ─────────────────────────────────────────────────────────────────
    if (phone?.trim()) {
      const stripped = phone.trim().replace(/[\s\-().+]/g, "");
      const normalized = stripped.startsWith("09") ? "63" + stripped.slice(1) : stripped;

      const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
      const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

      const configRes = await fetch(`${SUPABASE_URL}/rest/v1/admin_config?id=eq.1`, {
        headers: { "apikey": SERVICE_KEY, "Authorization": `Bearer ${SERVICE_KEY}` },
      });
      const configData = (await configRes.json()) as Array<{ sms_rate_limit_enabled?: boolean }>;
      const smsRateLimitEnabled = configData?.[0]?.sms_rate_limit_enabled !== false;

      let smsSent = false;
      let rateLimited = false;

      if (smsRateLimitEnabled) {
        const today = new Date().toISOString().slice(0, 10);
        const rlRes = await fetch(`${SUPABASE_URL}/rest/v1/sms_rate_limit`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": SERVICE_KEY,
            "Authorization": `Bearer ${SERVICE_KEY}`,
            "Prefer": "return=minimal",
          },
          body: JSON.stringify({ phone: normalized, sent_date: today }),
        });
        if (rlRes.status === 409) rateLimited = true;
      }

      if (!rateLimited) {
        const message = buildSmsMessage(driverName ?? "Driver", alertViewLink);
        console.log("[SMS] Trying TextBelt for", normalized.slice(0, 6) + "***");
        let provider = "none";
        smsSent = await trySendTextBelt(normalized, message);
        if (smsSent) {
          provider = "textbelt";
        } else {
          console.log("[SMS] TextBelt failed, trying PhilSMS");
          smsSent = await trySendPhilSms(normalized, message);
          if (smsSent) provider = "philsms";
        }
        console.log("[SMS] Result — sent:", smsSent, "provider:", provider);
        results.sms = { sent: smsSent, provider };
      } else {
        results.sms = { sent: false, reason: "rate_limited" };
      }
    }

    // ── Email ────────────────────────────────────────────────────────────────
    if (contactEmail) {
      const emailAlertViewLink = alertViewLink ?? appUrl;
      console.log("[Email] Sending alert email to", contactEmail.slice(0, 4) + "***");
      const emailResult = await sendAlertEmail(contactEmail, driverName ?? "Driver", lat, lng, emailAlertViewLink);
      results.email = emailResult;
      console.log("[Email] Result:", emailResult);
    }

    return new Response(JSON.stringify({ ok: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
