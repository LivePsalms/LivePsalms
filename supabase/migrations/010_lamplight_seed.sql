-- Seed app_config with the Lamplight promo flag. While
-- lamplight_promo_active = true, every user has full Lamplight access
-- regardless of entitlement. Flipping this flag is a one-row update;
-- no code change, no migration, no deploy.

insert into public.app_config (key, value) values
  ('lamplight_promo_active', 'true'::jsonb),
  ('lamplight_promo_ends_at', 'null'::jsonb)
on conflict (key) do nothing;
