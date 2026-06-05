-- Connection Cards similarity threshold lives in app_config so the edge
-- function and the browser strip cannot disagree. Without this, the strip
-- could render a card at the loosened dev threshold (0.3) that the edge
-- function then rejected as `not_neighbor` at its hardcoded 0.78, producing
-- the "Couldn't read this connection" error with no possible recovery.
--
-- Seeded at 0.3 to preserve current dev behavior. Before prod ship, run:
--   update public.app_config
--     set value = '0.78'::jsonb, updated_at = now()
--     where key = 'lamplight_min_similarity';

insert into public.app_config (key, value) values
  ('lamplight_min_similarity', '0.3'::jsonb)
on conflict (key) do nothing;
