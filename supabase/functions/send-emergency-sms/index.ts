// @ts-nocheck — Deno runtime; Node/TS type checker does not apply here

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-snoozeguard-secret",
};

interface SmsPayload {
  phone: string;
  driverName: string;
  lat?: number | null;
  lng?: number | null;
}

function buildMessage(driverName: string, lat?: number | null, lng?: number | null): string {
  const mapsLink = lat != null && lng != null
    ? `https://maps.google.com/?q=${lat.toFixed(6)},${lng.toFixed(6)}`
    : null;
  return mapsLink
    ? `URGENT — SnoozeGuard Alert: ${driverName} has triggered a critical drowsiness alert. Current location: ${mapsLink} — Please call or check on them immediately.`
    : `URGENT — SnoozeGuard Alert: ${driverName} has triggered a critical drowsiness alert. Please call or check on them immediately.`;
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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Auth: static shared secret (no JWT — avoids ES256 gateway issue)
    const secret = req.headers.get("x-snoozeguard-secret");
    const expectedSecret = Deno.env.get("SMS_FUNCTION_SECRET");
    if (!expectedSecret || secret !== expectedSecret) {
      return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload: SmsPayload = await req.json();
    const { phone, driverName, lat, lng } = payload;

    if (!phone?.trim()) {
      return new Response(JSON.stringify({ ok: false, error: "phone is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Normalize to international format: 09XXXXXXXXX → 639XXXXXXXXX
    const stripped = phone.trim().replace(/[\s\-().+]/g, "");
    const normalized = stripped.startsWith("09") ? "63" + stripped.slice(1) : stripped;

    // Rate limit: 1 SMS per phone number per UTC calendar day
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
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

    if (rlRes.status === 409) {
      return new Response(JSON.stringify({ ok: false, reason: "rate_limited" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const message = buildMessage(driverName ?? "Driver", lat, lng);
    console.log("[SMS] Trying TextBelt for", normalized.slice(0, 6) + "***");
    let provider = "none";
    let sent = await trySendTextBelt(normalized, message);
    if (sent) {
      provider = "textbelt";
    } else {
      console.log("[SMS] TextBelt failed, trying PhilSMS");
      sent = await trySendPhilSms(normalized, message);
      if (sent) provider = "philsms";
    }
    console.log("[SMS] Result — sent:", sent, "provider:", provider);

    return new Response(JSON.stringify({ ok: sent, provider }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
