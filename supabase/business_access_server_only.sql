-- Apply with the server activation route. Existing access rows are preserved.
begin;
drop policy if exists "Users can create their own business access" on public.business_admins;
drop policy if exists "Users can update their own business access" on public.business_admins;
revoke insert, update, delete on public.business_admins from anon, authenticated;
commit;
