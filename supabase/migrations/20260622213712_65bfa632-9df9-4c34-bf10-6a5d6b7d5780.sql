
-- Enum roles
CREATE TYPE public.app_role AS ENUM ('admin', 'cajero');

-- Perfiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL DEFAULT '',
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_auth" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

-- User roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_roles_select_own" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

-- Auto-asignar rol cajero al primer signup; primer usuario también admin
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  user_count INT;
BEGIN
  INSERT INTO public.profiles (id, nombre, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nombre', split_part(NEW.email, '@', 1)), NEW.email);

  SELECT COUNT(*) INTO user_count FROM auth.users;
  IF user_count = 1 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'cajero') ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Planes
CREATE TABLE public.plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL UNIQUE,
  descripcion TEXT,
  saldo_inicial NUMERIC(12,2) NOT NULL DEFAULT 0,
  precio_venta NUMERIC(12,2) NOT NULL DEFAULT 0,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plans TO authenticated;
GRANT ALL ON public.plans TO service_role;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plans_all_staff" ON public.plans FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'cajero') OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'cajero') OR public.has_role(auth.uid(), 'admin'));

-- Tarifas por tipo de impresión
CREATE TABLE public.print_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  precio_pagina NUMERIC(12,2) NOT NULL,
  UNIQUE(plan_id, tipo)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.print_prices TO authenticated;
GRANT ALL ON public.print_prices TO service_role;
ALTER TABLE public.print_prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "print_prices_all_staff" ON public.print_prices FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'cajero') OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'cajero') OR public.has_role(auth.uid(), 'admin'));

-- Pines
CREATE TYPE public.pin_estado AS ENUM ('disponible','vendido','agotado','inactivo');
CREATE TABLE public.pins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  plan_id UUID NOT NULL REFERENCES public.plans(id),
  saldo_actual NUMERIC(12,2) NOT NULL DEFAULT 0,
  saldo_inicial NUMERIC(12,2) NOT NULL DEFAULT 0,
  estado pin_estado NOT NULL DEFAULT 'disponible',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pins TO authenticated;
GRANT ALL ON public.pins TO service_role;
ALTER TABLE public.pins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pins_all_staff" ON public.pins FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'cajero') OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'cajero') OR public.has_role(auth.uid(), 'admin'));

-- Ventas
CREATE TABLE public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pin_id UUID NOT NULL REFERENCES public.pins(id),
  cliente_nombre TEXT,
  cliente_telefono TEXT NOT NULL,
  precio_venta NUMERIC(12,2) NOT NULL,
  vendido_por UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales TO authenticated;
GRANT ALL ON public.sales TO service_role;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sales_all_staff" ON public.sales FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'cajero') OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'cajero') OR public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.mark_pin_sold()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.pins SET estado = 'vendido' WHERE id = NEW.pin_id AND estado = 'disponible';
  RETURN NEW;
END $$;
CREATE TRIGGER trg_mark_pin_sold AFTER INSERT ON public.sales
FOR EACH ROW EXECUTE FUNCTION public.mark_pin_sold();

-- Impresiones (print_jobs)
CREATE TABLE public.print_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pin_id UUID NOT NULL REFERENCES public.pins(id),
  tipo_impresion TEXT NOT NULL,
  cantidad_paginas INT NOT NULL CHECK (cantidad_paginas > 0),
  costo_unitario NUMERIC(12,2) NOT NULL,
  costo_total NUMERIC(12,2) NOT NULL,
  saldo_restante NUMERIC(12,2) NOT NULL,
  registrado_por UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.print_jobs TO authenticated;
GRANT ALL ON public.print_jobs TO service_role;
ALTER TABLE public.print_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "print_jobs_all_staff" ON public.print_jobs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'cajero') OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'cajero') OR public.has_role(auth.uid(), 'admin'));

-- Función para registrar una impresión atómicamente (descuenta saldo)
CREATE OR REPLACE FUNCTION public.register_print(
  _pin_id UUID, _tipo TEXT, _paginas INT, _user UUID
) RETURNS public.print_jobs LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_pin public.pins%ROWTYPE;
  v_price NUMERIC(12,2);
  v_total NUMERIC(12,2);
  v_new_saldo NUMERIC(12,2);
  v_job public.print_jobs%ROWTYPE;
BEGIN
  SELECT * INTO v_pin FROM public.pins WHERE id = _pin_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pin no encontrado'; END IF;
  IF v_pin.estado = 'inactivo' THEN RAISE EXCEPTION 'Pin inactivo'; END IF;

  SELECT precio_pagina INTO v_price FROM public.print_prices WHERE plan_id = v_pin.plan_id AND tipo = _tipo;
  IF v_price IS NULL THEN RAISE EXCEPTION 'Tipo de impresión no configurado para este plan'; END IF;

  v_total := v_price * _paginas;
  IF v_pin.saldo_actual < v_total THEN RAISE EXCEPTION 'Saldo insuficiente. Disponible: %, requerido: %', v_pin.saldo_actual, v_total; END IF;

  v_new_saldo := v_pin.saldo_actual - v_total;

  UPDATE public.pins
    SET saldo_actual = v_new_saldo,
        estado = CASE WHEN v_new_saldo <= 0 THEN 'agotado'::pin_estado ELSE estado END
    WHERE id = _pin_id;

  INSERT INTO public.print_jobs(pin_id, tipo_impresion, cantidad_paginas, costo_unitario, costo_total, saldo_restante, registrado_por)
  VALUES (_pin_id, _tipo, _paginas, v_price, v_total, v_new_saldo, _user)
  RETURNING * INTO v_job;

  RETURN v_job;
END $$;

GRANT EXECUTE ON FUNCTION public.register_print(UUID,TEXT,INT,UUID) TO authenticated;

-- Seed planes y precios
INSERT INTO public.plans (nombre, descripcion, saldo_inicial, precio_venta) VALUES
  ('Bronce', 'Plan básico', 5000, 5000),
  ('Plata', 'Plan intermedio', 15000, 15000),
  ('Oro', 'Plan premium', 30000, 30000);

INSERT INTO public.print_prices (plan_id, tipo, precio_pagina)
SELECT id, t.tipo, t.precio FROM public.plans, (VALUES
  ('bw_carta', 0.50),
  ('color_carta', 2.00),
  ('bw_oficio', 0.70),
  ('color_oficio', 2.50)
) AS t(tipo, precio);
