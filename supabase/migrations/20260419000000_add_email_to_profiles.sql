-- Add email column to profiles and update trigger to populate it

alter table public.profiles
  add column if not exists email text;

-- Backfill email from auth.users for existing rows
update public.profiles p
set email = u.email
from auth.users u
where p.id = u.id and p.email is null;

-- Update trigger to include email on new user creation
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    'driver',
    coalesce(new.raw_user_meta_data->>'email', new.email)
  );
  return new;
end;
$$;
