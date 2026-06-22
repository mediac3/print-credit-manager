## Objetivo

Aplicación web para que un cajero/administrador venda pines de impresión (Bronce, Plata, Oro), gestione su saldo, registre impresiones que descuentan del saldo, importe catálogo de pines desde Excel, envíe el recibo por WhatsApp Colombia (link wa.me) e imprima el ticket.

## Backend (Lovable Cloud)

Tablas:
- `profiles` — admin/cajero (vinculado a `auth.users`).
- `user_roles` + enum `app_role` (`admin`, `cajero`) con función `has_role` (patrón seguro estándar).
- `plans` — Bronce, Plata, Oro. Campos: id, nombre, descripción, saldo_inicial, activo.
- `print_prices` — tarifas por plan y tipo de impresión. Campos: plan_id, tipo (`bw_carta`, `color_carta`, `bw_oficio`, `color_oficio`, o personalizado), precio_por_pagina. Permite agregar/quitar tipos por plan. Valores por defecto sembrados: 0.50, 2.00, 0.70, 2.50.
- `pins` — catálogo. Campos: id, codigo/usuario, password (hash), plan_id, saldo_actual, estado (`disponible`, `vendido`, `agotado`), fecha_creacion.
- `sales` — ventas. Campos: id, pin_id, cliente_nombre (opcional), cliente_telefono, precio_venta, vendido_por (user_id), fecha.
- `print_jobs` — impresiones registradas manualmente. Campos: id, pin_id, tipo_impresion, cantidad_paginas, costo_unitario, costo_total, fecha, registrado_por.

Reglas:
- RLS habilitada en todas; solo usuarios autenticados con rol `admin` o `cajero` pueden leer/escribir.
- GRANTs explícitos a `authenticated` y `service_role` en cada tabla.
- Trigger/función para descontar saldo del pin al insertar en `print_jobs` (valida saldo suficiente).
- Trigger para marcar pin como `vendido` al insertar en `sales`.

Server functions (`createServerFn` + `requireSupabaseAuth`):
- `importPinsFromExcel` — recibe filas parseadas, valida y hace bulk insert.
- `registerSale` — crea venta, marca pin, retorna datos para recibo.
- `registerPrintJob` — valida saldo, inserta job, descuenta saldo.
- `getDashboardStats` — totales ventas, pines disponibles/vendidos, ingresos del día/mes, impresiones del día.

## Frontend

Stack: TanStack Start (ya configurado), Tailwind + shadcn, sidebar colapsable.

Rutas (todas bajo `_authenticated`):
- `/auth` — login email/password.
- `/` (dashboard) — tarjetas con KPIs (ventas hoy, ingresos, pines disponibles por plan, impresiones del día), gráfico de ventas últimos 7 días, tabla últimas ventas.
- `/planes` — CRUD de planes y de tarifas por tipo de impresión (agregar/quitar tipos dinámicamente por plan).
- `/pines` — listado/filtrado por plan y estado, búsqueda, ver detalle (saldo, historial de impresiones). Botón "Importar Excel" (drop de `.xlsx`, preview, confirmar). Botón "Crear pin manual".
- `/ventas` — formulario de venta: seleccionar pin disponible, ingresar nombre y **teléfono cliente (obligatorio, formato CO +57)**, precio. Tras guardar: modal con ticket que incluye botón **Imprimir** (usa `window.print` con CSS print-only) y botón **Enviar WhatsApp** (abre `https://wa.me/57<telefono>?text=<recibo url-encoded>`).
- `/impresiones` — registrar impresión: seleccionar pin (login con usuario+password del pin o búsqueda admin), tipo (según plan), cantidad páginas; muestra costo calculado y saldo restante.
- `/usuarios` — gestión de cajeros (solo admin).

UX:
- Diseño limpio inspirado en Papercut NG: sidebar oscuro con íconos, contenido en cards blancas, tipografía sans (Inter), tokens semánticos en `src/styles.css` (no colores hardcoded), tema claro por defecto con acento azul corporativo.
- Validación con Zod en cada formulario.
- Toasts con sonner para feedback.

## Importación Excel

- Dependencia: `xlsx` (SheetJS) en cliente para parsear.
- Plantilla descargable con columnas: `usuario`, `password`, `plan` (Bronce/Plata/Oro), `saldo_inicial` (opcional, default del plan).
- Preview tabla con validación (plan existe, usuario único, password no vacío) antes de confirmar bulk insert.

## Ticket / WhatsApp

- Componente `TicketRecibo` renderiza recibo (negocio, fecha, pin usuario, plan, saldo, precio, cajero).
- Botón Imprimir: `@media print` oculta el resto.
- Botón WhatsApp: genera texto formateado y abre `wa.me/57<numero>` en nueva pestaña.

## Detalles técnicos

- Passwords de pines: hash con bcrypt vía server function (no almacenar en claro). El cajero ve el password en claro **solo** una vez al vender (se retorna desde `registerSale`); luego solo hash.
- Importación Excel también recibe passwords en claro, se hashean en server function antes de insertar.
- Todo el debito de saldo ocurre en trigger SQL para atomicidad.
- Lovable Cloud se habilita al inicio para auth + DB.

## Fuera de alcance (confirmar si se requiere)

- Integración real con servidor de impresión / Papercut (es solo gestión manual).
- Pagos online (las ventas son en efectivo / registro manual de precio).
- App para cliente final.
