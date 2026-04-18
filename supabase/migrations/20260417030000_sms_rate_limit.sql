-- Tracks one SMS per phone number per calendar day (UTC).
-- The Edge Function inserts here before sending; duplicate = rate limited.

create table if not exists public.sms_rate_limit (
  phone     text not null,
  sent_date date not null default current_date,
  primary key (phone, sent_date)
);

-- Only the service role (Edge Functions) may read/write this table.
alter table public.sms_rate_limit enable row level security;
