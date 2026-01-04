"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient"; // ✅ si tu path es distinto, ajústalo

type Role = "admin" | "staff" | "artist";
type Profile = { role: Role; full_name: string | null; artist_scope: string | null };

type ShowRow = {
  id: string;
  artist: "JEYF" | "ELGUDI" | null;
  show_date: string | null; // yyyy-mm-dd
  show_cost: number | null;
  advance_paid: number | null;
  viaticos_cobrados: number | null;
  km_distance: number | null;
};

function cardStyle(): React.CSSProperties {
  return { border: "1px solid #E5E7EB", borderRadius: 18, background: "white", padding: 16 };
}
function labelStyle(): React.CSSProperties {
  return { fontSize: 12, fontWeight: 900, opacity: 0.7, marginBottom: 6 };
}

function money(n: number) {
  try {
    return n.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });
  } catch {
    return `$${Math.round(n)}`;
  }
}
function num(n: number) {
  return n.toLocaleString("es-MX");
}
function safe(n: any) {
  const x = Number(n);
  return Number.isFinite(x) ? x : 0;
}
function parseDateYYYYMMDD(s?: string | null) {
  if (!s) return null;
  // date-only para comparar sin broncas de timezone
  const [y, m, d] = s.split("-").map((t) => Number(t));
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}
function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function computeMetrics(rows: ShowRow[]) {
  const today = startOfToday();

  const totalShows = rows.length;
  const upcoming = rows.filter((r) => {
    const dt = parseDateYYYYMMDD(r.show_date);
    return dt ? dt >= today : false;
  }).length;

  const ingresos = rows.reduce((acc, r) => acc + safe(r.show_cost), 0);
  const adelantos = rows.reduce((acc, r) => acc + safe(r.advance_paid), 0);
  const viaticos = rows.reduce((acc, r) => acc + safe(r.viaticos_cobrados), 0);

  const kmVals = rows.map((r) => safe(r.km_distance)).filter((x) => x > 0);
  const kmAvg = kmVals.length ? kmVals.reduce((a, b) => a + b, 0) / kmVals.length : 0;

  return { totalShows, upcoming, ingresos, adelantos, viaticos, kmAvg };
}

export default function DashboardPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [msg, setMsg] = useState("Cargando...");
  const [err, setErr] = useState("");

  const [shows, setShows] = useState<ShowRow[]>([]);

  // 1) Sesión + perfil
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        setLoading(true);
        setMsg("1) Revisando sesión...");
        setErr("");

        const { data: sData, error: sErr } = await supabase.auth.getSession();
        if (sErr) throw sErr;

        const user = sData.session?.user;
        if (!user) {
          router.replace("/login");
          return;
        }

        setMsg("2) Leyendo perfil...");
        const { data: p, error: pErr } = await supabase
          .from("profiles")
          .select("role, full_name, artist_scope")
          .eq("id", user.id)
          .maybeSingle();

        if (pErr) throw pErr;
        if (!p) throw new Error("No existe profile para este usuario.");

        if (cancelled) return;
        setProfile(p as Profile);

        setMsg("3) Cargando shows...");
        const { data: rows, error: shErr } = await supabase
          .from("shows")
          .select("id, artist, show_date, show_cost, advance_paid, viaticos_cobrados, km_distance")
          .order("show_date", { ascending: true });

        if (shErr) throw shErr;

        if (cancelled) return;
        setShows((rows || []) as ShowRow[]);
        setMsg("✅ Listo");
      } catch (e: any) {
        setMsg("❌ Error");
        setErr(e?.message ?? "Error desconocido");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const jeyfRows = useMemo(() => shows.filter((s) => s.artist === "JEYF"), [shows]);
  const elgudiRows = useMemo(() => shows.filter((s) => s.artist === "ELGUDI"), [shows]);

  const mAll = useMemo(() => computeMetrics(shows), [shows]);
  const mJ = useMemo(() => computeMetrics(jeyfRows), [jeyfRows]);
  const mG = useMemo(() => computeMetrics(elgudiRows), [elgudiRows]);

  return (
    <div
      style={{
        maxWidth: 1100,
        margin: "28px auto",
        padding: 16,
        fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial',
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <div style={{ fontSize: 26, fontWeight: 950, letterSpacing: -0.4 }}>Dashboard</div>
          <div style={{ opacity: 0.7, marginTop: 4 }}>
            {profile ? (
              <>
                Rol: <b>{profile.role}</b>
                {profile.full_name ? <> • {profile.full_name}</> : null}
              </>
            ) : (
              msg
            )}
          </div>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={() => router.push("/shows")}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid #E5E7EB",
              background: "white",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            Ver shows
          </button>

          <button
            onClick={() => router.push("/shows/new")}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid #111827",
              background: "#111827",
              color: "white",
              fontWeight: 950,
              cursor: "pointer",
            }}
          >
            + Nuevo show
          </button>
        </div>
      </div>

      {(loading || msg.startsWith("❌")) && (
        <div style={{ ...cardStyle(), marginTop: 14 }}>
          <div style={{ fontWeight: 950 }}>{msg}</div>
          {err && <div style={{ color: "crimson", marginTop: 6 }}>{err}</div>}
        </div>
      )}

      {!loading && (
        <div style={{ marginTop: 14, display: "grid", gap: 14 }}>
          {/* Totales */}
          <div style={cardStyle()}>
            <div style={{ fontWeight: 950, marginBottom: 12 }}>Resumen general</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
              <Metric title="Shows" value={num(mAll.totalShows)} />
              <Metric title="Próximos" value={num(mAll.upcoming)} />
              <Metric title="Ingresos" value={money(mAll.ingresos)} />
              <Metric title="Adelantos" value={money(mAll.adelantos)} />
              <Metric title="Km promedio" value={mAll.kmAvg ? `${Math.round(mAll.kmAvg)} km` : "—"} />
            </div>
            <div style={{ marginTop: 10, opacity: 0.7, fontSize: 12 }}>
              Viáticos cobrados: <b>{money(mAll.viaticos)}</b>
            </div>
          </div>

          {/* Por artista */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <ArtistCard
              title="Jey F"
              rows={jeyfRows}
              m={mJ}
              onOpen={() => router.push("/shows?artist=JEYF")}
            />
            <ArtistCard
              title="El Gudi"
              rows={elgudiRows}
              m={mG}
              onOpen={() => router.push("/shows?artist=ELGUDI")}
            />
          </div>

          {/* Últimos / próximos */}
          <div style={cardStyle()}>
            <div style={{ fontWeight: 950, marginBottom: 12 }}>Próximos shows (top 8)</div>
            <div style={{ display: "grid", gap: 10 }}>
              {shows
                .filter((r) => {
                  const dt = parseDateYYYYMMDD(r.show_date);
                  return dt ? dt >= startOfToday() : false;
                })
                .slice(0, 8)
                .map((r) => (
                  <div
                    key={r.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 10,
                      padding: "10px 12px",
                      border: "1px solid #E5E7EB",
                      borderRadius: 14,
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 950 }}>
                        {r.artist || "—"} • {r.show_date || "—"}
                      </div>
                      <div style={{ opacity: 0.7, fontSize: 12 }}>
                        Km: <b>{r.km_distance ?? "—"}</b> • Adelanto:{" "}
                        <b>{r.advance_paid != null ? money(r.advance_paid) : "—"}</b>
                      </div>
                    </div>

                    <button
                      onClick={() => router.push(`/shows/${r.id}/edit`)}
                      style={{
                        padding: "10px 12px",
                        borderRadius: 12,
                        border: "1px solid #E5E7EB",
                        background: "white",
                        fontWeight: 900,
                        cursor: "pointer",
                        height: "fit-content",
                      }}
                    >
                      Editar
                    </button>
                  </div>
                ))}

              {!shows.length && <div style={{ opacity: 0.7 }}>No hay shows todavía.</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({ title, value }: { title: string; value: string }) {
  return (
    <div style={{ border: "1px solid #E5E7EB", borderRadius: 14, padding: 12 }}>
      <div style={labelStyle()}>{title}</div>
      <div style={{ fontWeight: 950, fontSize: 18 }}>{value}</div>
    </div>
  );
}

function ArtistCard({
  title,
  rows,
  m,
  onOpen,
}: {
  title: string;
  rows: ShowRow[];
  m: ReturnType<typeof computeMetrics>;
  onOpen: () => void;
}) {
  return (
    <div style={cardStyle()}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
        <div style={{ fontWeight: 950 }}>{title}</div>
        <button
          onClick={onOpen}
          style={{
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid #E5E7EB",
            background: "white",
            fontWeight: 900,
            cursor: "pointer",
          }}
        >
          Ver lista
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12, marginTop: 12 }}>
        <Metric title="Shows" value={num(m.totalShows)} />
        <Metric title="Próximos" value={num(m.upcoming)} />
        <Metric title="Ingresos" value={money(m.ingresos)} />
        <Metric title="Adelantos" value={money(m.adelantos)} />
      </div>

      <div style={{ marginTop: 10, opacity: 0.7, fontSize: 12 }}>
        Viáticos: <b>{money(m.viaticos)}</b> • Km promedio: <b>{m.kmAvg ? `${Math.round(m.kmAvg)} km` : "—"}</b>
      </div>
    </div>
  );
}
