-- Shared /p/<code> presentations must open for recipients without a CRM account.
-- The existing security-definer resolver returns only the public presentation
-- addressed by its exact code; this does not grant access to the table or CRM.
grant execute on function public.resolve_portfolio_link(text) to anon, authenticated;
