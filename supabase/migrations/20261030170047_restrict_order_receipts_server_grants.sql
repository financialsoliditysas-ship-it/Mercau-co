begin;

-- Hosted default privileges may grant more than the receipt writer needs.
revoke all on public.order_creation_receipts from service_role;
grant select, insert on public.order_creation_receipts to service_role;

commit;
