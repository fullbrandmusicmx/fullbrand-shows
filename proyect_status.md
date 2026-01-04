Estoy desarrollando un Show Tracker (CRM) en Next.js (App Router) con Supabase.

Estado actual del proyecto:
- Proyecto en Next.js con App Router.
- Supabase Auth funcionando con roles: admin, staff, artist.
- Tabla principal: public.shows.
- Supabase client está en: app/lib/supabaseClient.ts.
- Google Maps + Places Autocomplete ya funcionan.
- Google Routes API ya funciona para calcular KM automáticamente desde:
  Origen fijo: El Morro, Boca del Río, Veracruz.

Estructura clave:
- app/shows/page.tsx → listado de shows
- app/shows/new/page.tsx → crear show
- app/shows/[id]/edit/page.tsx → editar show
- app/lib/supabaseClient.ts → cliente Supabase

Imports correctos:
- shows/page.tsx → import { supabase } from "../lib/supabaseClient";
- shows/new/page.tsx → import { supabase } from "../../lib/supabaseClient";
- shows/[id]/edit/page.tsx → import { supabase } from "../../../lib/supabaseClient";

Funcionalidades actuales:
- Crear show con dirección, KM, montos, hospitality.
- Editar show (formulario completo).
- Listar shows.
- Botón “Editar” desde /shows.
- Roles respetados (admin edita, staff ve, artist limitado).

Problemas recientes resueltos:
- Errores de schema cache (faltaban columnas).
- Error de imports mal apuntados.
- Error Google Routes API (ya quedó).

Siguiente objetivo:
- Calcular viáticos automático (basado en KM o reglas).
- Dashboard con métricas por artista.