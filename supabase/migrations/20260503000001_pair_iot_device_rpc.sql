-- Remove duplicate device_id rows (keep earliest created_at = original owner)
DELETE FROM public.user_iot_devices
WHERE user_id NOT IN (
  SELECT DISTINCT ON (device_id) user_id
  FROM public.user_iot_devices
  ORDER BY device_id, created_at ASC
);

-- One physical device per account
ALTER TABLE public.user_iot_devices
  ADD CONSTRAINT user_iot_devices_device_id_unique UNIQUE (device_id);

-- SECURITY DEFINER RPC: cross-user conflict check + atomic upsert
CREATE OR REPLACE FUNCTION public.pair_iot_device(p_device_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.user_iot_devices
    WHERE device_id = lower(trim(p_device_id))
      AND user_id <> auth.uid()
  ) THEN
    RAISE EXCEPTION 'Device is already registered to another account';
  END IF;

  INSERT INTO public.user_iot_devices (user_id, device_id, last_seen, created_at)
  VALUES (auth.uid(), lower(trim(p_device_id)), now(), now())
  ON CONFLICT (user_id) DO UPDATE
    SET device_id = lower(trim(p_device_id)),
        last_seen = now();
END;
$$;

REVOKE ALL ON FUNCTION public.pair_iot_device(text) FROM public;
GRANT EXECUTE ON FUNCTION public.pair_iot_device(text) TO authenticated;
