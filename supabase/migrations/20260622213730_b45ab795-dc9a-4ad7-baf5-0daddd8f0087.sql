
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mark_pin_sold() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.register_print(UUID, TEXT, INT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_print(UUID, TEXT, INT, UUID) TO authenticated;
