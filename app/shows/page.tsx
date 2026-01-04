"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";

type Role = "admin" | "staff" | "artist";

type Profile = {
  role: Role;
  full_name: string | null;
  artist_scope: string | null; // "JEYF" | "ELGUDI"
};

type ShowRow = {
  id: string;
  created_at: string;

  show_date: string;
  artist: "JEYF" | "ELGUDI";
  show_type: "SHOWCASE" | "SHOW_COMPLETO";

  event_name: string;
  venue_name: string | null;

  address_text: string | null;
  maps_place_id: string | null;
  maps_lat: number | null;
  maps_lng: number | null;

  km_distance: number | null;

  hospitality: boolean | null;
  hotel_name: string | null;
  rooms_count: number | null;

  closed_date: string | null;
  notes: string | null;

  // Solo viene cuando consultamos public.shows (admin/artist)
  show_cost?: number | null;
  advance_paid?: number | null;
  viaticos_cobrados?: number | null;
};

function badge(text: string, kind: "ok" | "warn" | "info") {
  const bg =
    kind === "ok" ? "#E7F8EF" : kind === "warn" ? "#FFF3E6" : "#EEF2FF";
  const fg =
    kind === "ok" ? "#146C43" : kind === "warn" ? "#8A4B00" : "#243B9B";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "4px 10px",
        borderRadius: 999,
        background: bg,
        color: fg,
        fontSize: 12,
        fontWeight: 700,
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </span>
  );
}

export default function ShowsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("Cargando...");
  const [errorDetail, setErrorDetail] = useState("");

  const [profile, setProfile] = useState<Profile | null>(null);
  const [rows, setRows] = useState<ShowRow[]>([]);

  // UI state
  const [tab, setTab] = useState<"ALL" | "JEYF" | "ELGUDI">("ALL");
  const [q, setQ] = useState("");
  const [month, setMonth] = useState<string>(""); // "YYYY-MM"

  const canSeeMoney = profile?.role === "admin" || profile?.role === "artist";

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        setLoading(true);
        setStatus("1) Revisando sesión...");
        setErrorDetail("");

        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;

        const user = data.session?.user;
        if (!user) {
          router.replace("/login");
          return;
        }

        setStatus("2) Leyendo perfil...");
        const { data: p, error: pErr } = await supabase
          .from("profiles")
          .select("role, full_name, artist_scope")
          .eq("id", user.id)
          .maybeSingle();

        if (pErr) throw pErr;
        if (!p) {
          setStatus("❌ No existe profile para este usuario.");
          setErrorDetail("Crea el profile (profiles) con el UUID del usuario.");
          return;
        }

        if (cancelled) return;
        setProfile(p as Profile);

        setStatus("3) Cargando shows...");
        // ✅ Lógica por rol:
        // admin/artist -> leer public.shows (con montos)
        // staff -> leer public.shows_public (sin montos)
        if ((p as Profile).role === "staff") {
          const { data: list, error: listErr } = await supabase
            .from("shows_public")
            .select(
              "id, created_at, show_date, artist, show_type, event_name, venue_name, address_text, maps_place_id, maps_lat, maps_lng, km_distance, hospitality, hotel_name, rooms_count, closed_date, notes"
            )
            .order("show_date", { ascending: true });

          if (listErr) throw listErr;
          setRows((list ?? []) as any);
        } else {
          // admin o artist (artist ya queda filtrado por RLS)
          const { data: list, error: listErr } = await supabase
            .from("shows")
            .select(
              "id, created_at, show_date, artist, show_type, event_name, venue_name, address_text, maps_place_id, maps_lat, maps_lng, km_distance, hospitality, hotel_name, rooms_count, closed_date, notes, show_cost, advance_paid, viaticos_cobrados"
            )
            .order("show_date", { ascending: true });

          if (listErr) throw listErr;
          setRows((list ?? []) as any);
        }

        setStatus("✅ Listo");
      } catch (e: any) {
        setStatus("❌ Error");
        setErrorDetail(e?.message ?? "Error desconocido");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const filtered = useMemo(() => {
    const text = q.trim().toLowerCase();
    return rows.filter((r) => {
      const artistOk = tab === "ALL" ? true : r.artist === tab;
      const textOk =
        !text ||
        (r.event_name ?? "").toLowerCase().includes(text) ||
        (r.venue_name ?? "").toLowerCase().includes(text) ||
        (r.address_text ?? "").toLowerCase().includes(text);

      const monthOk = !month ? true : (r.show_date ?? "").startsWith(month);

      return artistOk && textOk && monthOk;
    });
  }, [rows, tab, q, month]);

  const totals = useMemo(() => {
    if (!canSeeMoney) return null;
    let showCost = 0;
    let advance = 0;
    let via = 0;

    for (const r of filtered) {
      showCost += Number(r.show_cost ?? 0);
      advance += Number(r.advance_paid ?? 0);
      via += Number(r.viaticos_cobrados ?? 0);
    }
    return { showCost, advance, via };
  }, [filtered, canSeeMoney]);

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    <div
      style={{
        maxWidth: 1200,
        margin: "28px auto",
        padding: 16,
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "center",
          marginBottom: 14,
        }}
      >
        <div>
          <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: -0.4 }}>
            Fullbrand • Shows
          </div>
          <div style={{ opacity: 0.7, marginTop: 4 }}>
            {profile ? (
              <>
                Rol: <b>{profile.role}</b>{" "}
                {profile.role === "artist" && profile.artist_scope ? (
                  <>• Artista: <b>{profile.artist_scope}</b></>
                ) : null}
              </>
            ) : (
              "Cargando perfil..."
            )}
          </div>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={() => router.push("/dashboard")}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid #E5E7EB",
              background: "white",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Dashboard
          </button>

          <button
            onClick={logout}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid #E5E7EB",
              background: "white",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Cerrar sesión
          </button>
        </div>
      </div>

      {/* Status */}
      {(loading || status.startsWith("❌")) && (
        <div
          style={{
            border: "1px solid #E5E7EB",
            borderRadius: 16,
            padding: 14,
            background: "white",
            marginBottom: 14,
          }}
        >
          <div style={{ fontWeight: 800 }}>{status}</div>
          {errorDetail && (
            <div style={{ marginTop: 6, color: "crimson" }}>{errorDetail}</div>
          )}
        </div>
      )}

      {/* Filters */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 220px",
          gap: 12,
          alignItems: "center",
          marginBottom: 14,
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", gap: 8 }}>
            {(["ALL", "JEYF", "ELGUDI"] as const).map((t) => {
              const active = tab === t;
              return (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 999,
                    border: "1px solid #E5E7EB",
                    background: active ? "#111827" : "white",
                    color: active ? "white" : "#111827",
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  {t === "ALL" ? "Todos" : t === "JEYF" ? "Jey F" : "El Gudi"}
                </button>
              );
            })}
          </div>

          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar: evento, venue, dirección..."
            style={{
              flex: 1,
              minWidth: 240,
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid #E5E7EB",
              background: "white",
            }}
          />
        </div>

        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          style={{
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid #E5E7EB",
            background: "white",
          }}
        />
      </div>

      {/* Totals (solo admin/artist) */}
      {totals && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: 12,
            marginBottom: 14,
          }}
        >
          {[
            ["Total show", totals.showCost],
            ["Total adelantos", totals.advance],
            ["Total viáticos cobrados", totals.via],
          ].map(([label, value]) => (
            <div
              key={label as string}
              style={{
                border: "1px solid #E5E7EB",
                borderRadius: 16,
                padding: 14,
                background: "white",
              }}
            >
              <div style={{ opacity: 0.7, fontWeight: 700 }}>{label}</div>
              <div style={{ fontSize: 22, fontWeight: 900, marginTop: 6 }}>
                ${Number(value).toLocaleString("es-MX")}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      <div
        style={{
          border: "1px solid #E5E7EB",
          borderRadius: 18,
          background: "white",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: 14,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderBottom: "1px solid #E5E7EB",
          }}
        >
          <div style={{ fontWeight: 900 }}>
            Shows ({filtered.length})
          </div>

          {/* Botón solo para admin (después lo conectamos a /shows/new) */}
          {profile?.role === "admin" && (
            <button
              onClick={() => router.push("/shows/new")}
              style={{
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid #111827",
                background: "#111827",
                color: "white",
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              + Nuevo show
            </button>
          )}
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", background: "#F9FAFB" }}>
                {[
                  "Fecha",
                  "Artista",
                  "Tipo",
                  "Evento / Venue",
                  "Ciudad / Dirección",
                  "Hosp.",
                  canSeeMoney ? "Monto" : null,
                  canSeeMoney ? "Adelanto" : null,
                  canSeeMoney ? "Viáticos" : null,
                ]
                  .filter(Boolean)
                  .map((h) => (
                    <th
                      key={h as string}
                      style={{
                        padding: 12,
                        fontSize: 12,
                        textTransform: "uppercase",
                        letterSpacing: 0.6,
                        color: "#374151",
                        borderBottom: "1px solid #E5E7EB",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {h}
                    </th>
                  ))}
              </tr>
            </thead>

            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} style={{ borderBottom: "1px solid #F3F4F6" }}>
                  <td style={{ padding: 12, whiteSpace: "nowrap", fontWeight: 800 }}>
                    {r.show_date}
                  </td>

                  <td style={{ padding: 12 }}>
                    {r.artist === "JEYF"
                      ? badge("Jey F", "info")
                      : badge("El Gudi", "info")}
                  </td>

                  <td style={{ padding: 12 }}>
                    {r.show_type === "SHOWCASE"
                      ? badge("Showcase", "warn")
                      : badge("Show completo", "ok")}
                  </td>

                  <td style={{ padding: 12, minWidth: 260 }}>
                    <div style={{ fontWeight: 900 }}>{r.event_name}</div>
                    <div style={{ opacity: 0.75, marginTop: 2 }}>
                      {r.venue_name || "—"}
                    </div>
                  </td>

                  <td style={{ padding: 12, minWidth: 280 }}>
                    <div style={{ fontWeight: 700 }}>
                      {r.address_text || "—"}
                    </div>
                  </td>

                  <td style={{ padding: 12 }}>
                    {r.hospitality ? badge("Sí", "ok") : badge("No", "warn")}
                  </td>

                  {canSeeMoney && (
                    <>
                      <td style={{ padding: 12, whiteSpace: "nowrap", fontWeight: 900 }}>
                        ${Number(r.show_cost ?? 0).toLocaleString("es-MX")}
                      </td>
                      <td style={{ padding: 12, whiteSpace: "nowrap", fontWeight: 900 }}>
                        ${Number(r.advance_paid ?? 0).toLocaleString("es-MX")}
                      </td>
                      <td style={{ padding: 12, whiteSpace: "nowrap", fontWeight: 900 }}>
                        ${Number(r.viaticos_cobrados ?? 0).toLocaleString("es-MX")}
                      </td>
                    </>
                  )}
                </tr>
              ))}

              {!loading && filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={canSeeMoney ? 9 : 6}
                    style={{ padding: 18, opacity: 0.7 }}
                  >
                    No hay shows con esos filtros.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      
    </div>
  );
}
