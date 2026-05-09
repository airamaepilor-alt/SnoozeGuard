import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";

// ─── Types ─────────────────────────────────────────────────────────────────────

type PageState =
  | "loading"
  | "pending"       // waiting for user to click Accept or Decline
  | "processing"    // API call in flight
  | "accepted"      // just accepted
  | "already_accepted"
  | "declined"      // just declined
  | "already_declined"
  | "expired"
  | "invalid"
  | "error";

// ─── Icons ─────────────────────────────────────────────────────────────────────

function Icon({ name, className }: { name: string; className?: string }) {
  return (
    <span
      className={`material-symbols-outlined ${className ?? ""}`}
      style={{ fontVariationSettings: "'FILL' 1" }}
    >
      {name}
    </span>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export function AcceptGuardianPage() {
  const [params] = useSearchParams();
  const token  = params.get("token");
  const action = params.get("action") as "accept" | "decline" | null;

  const [state, setState] = useState<PageState>("loading");
  const [driverName, setDriverName] = useState("A SnoozeGuard user");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const didAutoAct = useRef(false);

  // ── Load request info ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!token) { setState("invalid"); return; }

    (async () => {
      const { data, error } = await supabase.rpc("get_contact_request_by_token", {
        p_token: token,
      });

      if (error || !data || (data as unknown[]).length === 0) {
        setState("invalid");
        return;
      }

      const row = (data as Array<{ id: string; driver_name: string; status: string; expired: boolean }>)[0];
      setDriverName(row.driver_name);

      if (row.expired) { setState("expired"); return; }
      if (row.status === "accepted") { setState("already_accepted"); return; }
      if (row.status === "rejected") { setState("already_declined"); return; }

      // If the email link pre-filled an action, auto-process it once
      if (action && !didAutoAct.current) {
        didAutoAct.current = true;
        if (action === "accept") await doAccept(false);
        else if (action === "decline") await doDecline(false);
      } else {
        setState("pending");
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // ── Actions ────────────────────────────────────────────────────────────────
  async function doAccept(fromButton = true) {
    if (fromButton) setState("processing");
    const { data, error } = await supabase.rpc("accept_contact_request_by_token", {
      p_token: token!,
    });
    if (error) {
      setErrorMsg(error.message);
      setState("error");
      return;
    }
    const result = data as { success: boolean; already_accepted?: boolean; error?: string };
    if (!result.success) {
      setErrorMsg(result.error ?? "Something went wrong.");
      setState("error");
      return;
    }
    setState(result.already_accepted ? "already_accepted" : "accepted");
  }

  async function doDecline(fromButton = true) {
    if (fromButton) setState("processing");
    const { data, error } = await supabase.rpc("decline_contact_request_by_token", {
      p_token: token!,
    });
    if (error) {
      setErrorMsg(error.message);
      setState("error");
      return;
    }
    const result = data as { success: boolean; already_resolved?: boolean; error?: string };
    if (!result.success) {
      setErrorMsg(result.error ?? "Something went wrong.");
      setState("error");
      return;
    }
    setState("declined");
  }

  // ── Render helpers ─────────────────────────────────────────────────────────
  const card = (content: React.ReactNode) => (
    <div className="min-h-dvh flex flex-col items-center justify-center bg-[#0f0f0f] px-4 py-12 font-body">
      <div className="w-full max-w-sm bg-[#1a1a1a] rounded-3xl overflow-hidden border border-white/5 shadow-2xl">
        {/* Brand header */}
        <div className="bg-[#1e3a5f] px-6 py-5 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
            <span className="text-white font-black text-[10px] tracking-tight">SG</span>
          </div>
          <span className="text-white font-black text-[11px] tracking-[0.25em] uppercase">SnoozeGuard</span>
        </div>
        {content}
      </div>
      <p className="mt-6 text-xs text-white/20 text-center max-w-xs">
        SnoozeGuard — Driver Safety System. You do not need an account to accept or decline.
      </p>
    </div>
  );

  // ── States ─────────────────────────────────────────────────────────────────

  if (state === "loading") {
    return card(
      <div className="flex flex-col items-center gap-4 p-10">
        <Icon name="progress_activity" className="text-blue-400 text-4xl animate-spin" />
        <p className="text-white/60 text-sm">Loading request…</p>
      </div>
    );
  }

  if (state === "processing") {
    return card(
      <div className="flex flex-col items-center gap-4 p-10">
        <Icon name="progress_activity" className="text-blue-400 text-4xl animate-spin" />
        <p className="text-white/60 text-sm">Processing…</p>
      </div>
    );
  }

  if (state === "accepted") {
    return card(
      <div className="flex flex-col items-center gap-5 p-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 flex items-center justify-center">
          <Icon name="verified" className="text-emerald-400 text-4xl" />
        </div>
        <div>
          <h2 className="text-white font-bold text-xl mb-2">You're now a guardian!</h2>
          <p className="text-white/50 text-sm leading-relaxed">
            You accepted {driverName}'s request. You'll receive an SMS if they trigger a fatigue alert.
          </p>
        </div>
        <div className="w-full bg-white/5 rounded-2xl p-4 text-left space-y-2">
          <p className="text-[10px] font-bold tracking-widest text-white/30 uppercase">What happens next</p>
          <p className="text-sm text-white/60 leading-relaxed">
            If {driverName} shows signs of severe drowsiness and doesn't acknowledge the alert,
            you'll get a text message with their last known location.
          </p>
        </div>
      </div>
    );
  }

  if (state === "already_accepted") {
    return card(
      <div className="flex flex-col items-center gap-5 p-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-blue-500/15 flex items-center justify-center">
          <Icon name="check_circle" className="text-blue-400 text-4xl" />
        </div>
        <div>
          <h2 className="text-white font-bold text-xl mb-2">Already accepted</h2>
          <p className="text-white/50 text-sm leading-relaxed">
            You've already accepted {driverName}'s guardian request. No further action needed.
          </p>
        </div>
      </div>
    );
  }

  if (state === "declined") {
    return card(
      <div className="flex flex-col items-center gap-5 p-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center">
          <Icon name="cancel" className="text-white/40 text-4xl" />
        </div>
        <div>
          <h2 className="text-white font-bold text-xl mb-2">Request declined</h2>
          <p className="text-white/50 text-sm leading-relaxed">
            You've declined {driverName}'s guardian request. They will be notified. You can close this page.
          </p>
        </div>
      </div>
    );
  }

  if (state === "already_declined") {
    return card(
      <div className="flex flex-col items-center gap-5 p-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center">
          <Icon name="block" className="text-white/30 text-4xl" />
        </div>
        <div>
          <h2 className="text-white font-bold text-xl mb-2">Already declined</h2>
          <p className="text-white/50 text-sm leading-relaxed">
            You previously declined this request. If you changed your mind, ask {driverName} to send a new invitation.
          </p>
        </div>
      </div>
    );
  }

  if (state === "expired") {
    return card(
      <div className="flex flex-col items-center gap-5 p-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-yellow-500/10 flex items-center justify-center">
          <Icon name="timer_off" className="text-yellow-400 text-4xl" />
        </div>
        <div>
          <h2 className="text-white font-bold text-xl mb-2">Link expired</h2>
          <p className="text-white/50 text-sm leading-relaxed">
            This invitation link is older than 7 days. Ask {driverName} to send you a fresh request.
          </p>
        </div>
      </div>
    );
  }

  if (state === "invalid" || state === "error") {
    return card(
      <div className="flex flex-col items-center gap-5 p-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center">
          <Icon name="link_off" className="text-red-400 text-4xl" />
        </div>
        <div>
          <h2 className="text-white font-bold text-xl mb-2">
            {state === "invalid" ? "Invalid link" : "Something went wrong"}
          </h2>
          <p className="text-white/50 text-sm leading-relaxed">
            {errorMsg ?? "This link doesn't look right. Make sure you copied the full URL from the email or SMS."}
          </p>
        </div>
      </div>
    );
  }

  // ── Pending: show Accept / Decline buttons ─────────────────────────────────
  return card(
    <div className="p-7 space-y-6">
      {/* Guardian request card */}
      <div className="space-y-1">
        <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-blue-400">Guardian Request</p>
        <h2 className="text-white font-bold text-xl leading-snug">
          {driverName} wants you as their emergency guardian
        </h2>
      </div>

      <p className="text-sm text-white/50 leading-relaxed">
        As their guardian, you'll receive an <strong className="text-white/70">SMS alert</strong> if
        they show critical signs of drowsiness during a drive and don't respond in time.
      </p>

      <div className="bg-white/5 rounded-2xl p-4 space-y-2">
        <p className="text-[10px] font-bold tracking-widest text-white/30 uppercase">What this means</p>
        <ul className="text-sm text-white/50 space-y-1.5 leading-relaxed">
          <li>• You'll get a text with their location when an alert fires</li>
          <li>• You can call or SMS them directly from the alert</li>
          <li>• You can decline at any time</li>
        </ul>
      </div>

      <div className="space-y-3 pt-1">
        <button
          onClick={() => void doAccept()}
          className="w-full py-4 bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white font-bold text-sm rounded-2xl transition-all flex items-center justify-center gap-2 shadow-[0_8px_24px_rgba(37,99,235,0.3)]"
        >
          <Icon name="verified" className="text-base" />
          Accept — become their guardian
        </button>
        <button
          onClick={() => void doDecline()}
          className="w-full py-3.5 border border-white/10 hover:bg-white/5 active:scale-[0.98] text-white/40 hover:text-white/60 font-medium text-sm rounded-2xl transition-all"
        >
          No thanks, decline
        </button>
      </div>
    </div>
  );
}
