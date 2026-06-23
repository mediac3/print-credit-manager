
-- 1. Lock down SECURITY DEFINER functions: revoke public execute, re-grant only what the app calls directly.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mark_pin_sold() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.register_print(uuid, text, integer, uuid) FROM PUBLIC, anon, authenticated;

-- register_print is invoked from the app by signed-in cajeros/admins.
GRANT EXECUTE ON FUNCTION public.register_print(uuid, text, integer, uuid) TO authenticated;

-- 2. Restrict profiles SELECT: users see only their own row; admins still see all (existing admin policy stays in place).
DROP POLICY IF EXISTS profiles_select_auth ON public.profiles;
CREATE POLICY profiles_select_own
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- 3. user_roles: explicit admin-only write policies (was SELECT-only).
CREATE POLICY user_roles_admin_insert
  ON public.user_roles
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY user_roles_admin_update
  ON public.user_roles
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY user_roles_admin_delete
  ON public.user_roles
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
