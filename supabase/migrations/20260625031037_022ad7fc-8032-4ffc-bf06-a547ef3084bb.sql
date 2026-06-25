
-- PLANS: split policies
DROP POLICY IF EXISTS plans_all_staff ON public.plans;
CREATE POLICY plans_select_staff ON public.plans FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'cajero') OR public.has_role(auth.uid(),'admin'));
CREATE POLICY plans_admin_write ON public.plans FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY plans_admin_update ON public.plans FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY plans_admin_delete ON public.plans FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

-- PRINT_PRICES
DROP POLICY IF EXISTS print_prices_all_staff ON public.print_prices;
CREATE POLICY print_prices_select_staff ON public.print_prices FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'cajero') OR public.has_role(auth.uid(),'admin'));
CREATE POLICY print_prices_admin_insert ON public.print_prices FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY print_prices_admin_update ON public.print_prices FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY print_prices_admin_delete ON public.print_prices FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

-- PINS: cajero can read, only admin can create/import/delete. Updates allowed for staff (sale flow updates via SECURITY DEFINER trigger; keep update permissive in case of UI use).
DROP POLICY IF EXISTS pins_all_staff ON public.pins;
CREATE POLICY pins_select_staff ON public.pins FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'cajero') OR public.has_role(auth.uid(),'admin'));
CREATE POLICY pins_admin_insert ON public.pins FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY pins_admin_update ON public.pins FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY pins_admin_delete ON public.pins FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));
