"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

type Role = "admin" | "staff" | "artist";
type Profile = { role: Role; full_name: string | null; artist_scope: string | null };

type FormState = {
  show_date: string;
  artist: "JEYF" | "ELGUDI";
  show_type: "SHOWCASE" | "SHOW_COMPLETO";
  event_name: string;
  venue_name: string;

  address_text: string;
  maps_place_id: string;
  maps_lat: string;
  maps_lng: string;

  km_distance: string;

  hospitality: boolean;
  hotel_name: string;
  rooms_count: string;

  show_cost: string;
  advance_paid: string;
  viaticos_cobrados: string;

  closed_date: string;
  notes: string;
};

function inputStyle(): React.CSSProperties {
  return {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #E5E7EB",
    background: "white",
    outline: "none",
  };
}
function labelStyle(): React.CSSProperties {
  return { fontSize: 12, fontWeight: 900, opacity: 0.7, marginBottom: 6 };
}
function cardStyle(): React.CSSProperties {
  return { border: "1px solid #E5E7EB", borderRadius: 18, background: "white", padding: 16 };
}
function safeNum(s: string) {
  const n = Number(String(s ?? "").replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

export default function EditShowPage() {
  const router = useRouter();
  const params = useParams();
  const id = String((params as any)?.id ?? "");

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [msg, setMsg] = useState("Cargando...");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  // Google status
  const [mapsReady, setMapsReady] = useState(false);
  const addressInputRef = useRef<HTMLInputElement | null>(null);
  const autocompleteRef = useRef<any>(null);

  const [f, setF] = useState<FormState>({
    show_date: "",
    artist: "JEYF",
    show_type: "SHOWCASE",
    event_name: "",
    venue_name: "",

    address_text: "",
    maps_place_id: "",
    maps_lat: "",
    maps_lng: "",

    km_distance: "",

    hospitality: false,
    hotel_name: "",
    rooms_count: "",

    show_cost: "",
    advance_paid: "",
    viaticos_cobrados: "",

    closed_date: "",
    notes: "",
  });

  const isValid = useMemo(() => {
    return !!f.show_date && f.event_name.trim().length >= 2;
  }, [f.show_date, f.event_name]);

  const canEdit = profile?.role === "admin" || profile?.role === "staff";

  // 1) Session + profile + load show
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
        if (!p) {
          setMsg("❌ No existe profile para este usuario.");
          setErr("Crea el profile en public.profiles con id = auth.uid().");
          return;
        }

        if (cancelled) return;
        setProfile(p as Profile);

        // ✅ Solo admin/staff pueden editar
        if ((p as Profile).role !== "admin" && (p as Profile).role !== "staff") {
          router.replace("/shows");
          return;
        }

        setMsg("3) Cargando show...");
        const { data: show, error: showErr } = await supabase
          .from("shows")
          .select(
            "show_date, artist, show_type, event_name, venue_name, address_text, maps_place_id, maps_lat, maps_lng, km_distance, hospitality, hotel_name, rooms_count, show_cost, advance_paid, viaticos_cobrados, closed_date, notes"
          )
          .eq("id", id)
          .maybeSingle();

        if (showErr) throw showErr;
        if (!show) {
          setMsg("❌ No encontré ese show.");
          setErr("Revisa que el id exista y que tu RLS permita leerlo.");
          return;
        }

        setF({
          show_date: show.show_date ?? "",
          artist: (show.artist ?? "JEYF") as any,
          show_type: (show.show_type ?? "SHOWCASE") as any,
          event_name: show.event_name ?? "",
          venue_name: show.venue_name ?? "",

          address_text: show.address_text ?? "",
          maps_place_id: show.maps_place_id ?? "",
          maps_lat: show.maps_lat != null ? String(show.maps_lat) : "",
          maps_lng: show.maps_lng != null ? String(show.maps_lng) : "",

          km_distance: show.km_distance != null ? String(show.km_distance) : "",

          hospitality: !!show.hospitality,
          hotel_name: show.hotel_name ?? "",
          rooms_count: show.rooms_count != null ? String(show.rooms_count) : "",

          show_cost: show.show_cost != null ? String(show.show_cost) : "",
          advance_paid: show.advance_paid != null ? String(show.advance_paid) : "",
          viaticos_cobrados: show.viaticos_cobrados != null ? String(show.viaticos_cobrados) : "",

          closed_date: show.closed_date ?? "",
          notes: show.notes ?? "",
        });

        setMsg("✅ Listo");
      } catch (e: any) {
        setMsg("❌ Error");
        setErr(e?.message ?? "Error desconocido");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (id) init();
    return () => {
      cancelled = true;
    };
  }, [router, id]);

  // 2) Init Google Places Autocomplete
  useEffect(() => {
    if (!profile || !canEdit) return;

    let tries = 0;
    const timer = setInterval(() => {
      tries++;

      const w = window as any;
      const ok = !!w.google?.maps?.places && !!addressInputRef.current;

      if (!ok) {
        if (tries > 60) {
          setMapsReady(false);
          setErr(
            "Google Places no cargó. Revisa: Maps JavaScript API + Places API habilitadas, billing activo, y key con referrer localhost."
          );
          clearInterval(timer);
        }
        return;
      }

      if (autocompleteRef.current) {
        setMapsReady(true);
        clearInterval(timer);
        return;
      }

      try {
        autocompleteRef.current = new w.google.maps.places.Autocomplete(addressInputRef.current, {
          componentRestrictions: { country: ["mx"] },
          fields: ["formatted_address", "place_id", "geometry"],
          types: ["geocode"],
        });

        autocompleteRef.current.addListener("place_changed", () => {
          const place = autocompleteRef.current.getPlace();
          const address = place?.formatted_address || "";
          const placeId = place?.place_id || "";
          const lat = place?.geometry?.location?.lat?.();
          const lng = place?.geometry?.location?.lng?.();

          setF((prev) => ({
            ...prev,
            address_text: address || prev.address_text,
            maps_place_id: placeId,
            maps_lat: lat != null ? String(lat) : prev.maps_lat,
            maps_lng: lng != null ? String(lng) : prev.maps_lng,
          }));
        });

        setMapsReady(true);
        clearInterval(timer);
      } catch (e: any) {
        setMapsReady(false);
        setErr(e?.message ?? "Error inicializando Google Places");
        clearInterval(timer);
      }
    }, 150);

    return () => clearInterval(timer);
  }, [profile, canEdit]);

  async function updateShow() {
    try {
      if (!isValid) return;

      setSaving(true);
      setErr("");
      setMsg("Guardando cambios...");

      const payload: any = {
        show_date: f.show_date,
        artist: f.artist,
        show_type: f.show_type,
        event_name: f.event_name.trim(),
        venue_name: f.venue_name.trim() || null,

        address_text: f.address_text.trim() || null,
        maps_place_id: f.maps_place_id || null,
        maps_lat: safeNum(f.maps_lat),
        maps_lng: safeNum(f.maps_lng),

        km_distance: safeNum(f.km_distance),

        hospitality: !!f.hospitality,
        hotel_name: f.hotel_name.trim() || null,
        rooms_count: f.rooms_count ? Number(f.rooms_count) : null,

        show_cost: safeNum(f.show_cost),
        advance_paid: safeNum(f.advance_paid),
        viaticos_cobrados: safeNum(f.viaticos_cobrados),

        closed_date: f.closed_date || null,
        notes: f.notes.trim() || null,
      };

      const { error } = await supabase.from("shows").update(payload).eq("id", id);
      if (error) throw error;

      setMsg("✅ Cambios guardados");
      router.push("/shows");
    } catch (e: any) {
      setMsg("❌ No se pudo guardar");
      setErr(e?.message ?? "Error desconocido");
    } finally {
      setSaving(false);
    }
  }

  async function deleteShow() {
    try {
      if (!confirm("¿Seguro que quieres borrar este show?")) return;

      setSaving(true);
      setErr("");
      setMsg("Borrando...");

      const { error } = await supabase.from("shows").delete().eq("id", id);
      if (error) throw error;

      setMsg("✅ Show borrado");
      router.push("/shows");
    } catch (e: any) {
      setMsg("❌ No se pudo borrar");
      setErr(e?.message ?? "Error desconocido");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      style={{
        maxWidth: 1100,
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
          <div style={{ fontSize: 26, fontWeight: 950, letterSpacing: -0.4 }}>
            Editar show
          </div>
          <div style={{ opacity: 0.7, marginTop: 4 }}>
            {profile ? (
              <>
                Rol: <b>{profile.role}</b>
              </>
            ) : (
              msg
            )}
          </div>
        </div>

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
          ← Volver a shows
        </button>
      </div>

      {(loading || msg.startsWith("❌")) && (
        <div style={{ ...cardStyle(), marginBottom: 14 }}>
          <div style={{ fontWeight: 950 }}>{msg}</div>
          {err && <div style={{ color: "crimson", marginTop: 6 }}>{err}</div>}
        </div>
      )}

      {!loading && canEdit && (
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 14 }}>
          {/* Left */}
          <div style={{ display: "grid", gap: 14 }}>
            <div style={cardStyle()}>
              <div style={{ fontWeight: 950, marginBottom: 12 }}>Datos del evento</div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <div style={labelStyle()}>Fecha</div>
                  <input
                    type="date"
                    value={f.show_date}
                    onChange={(e) => setF({ ...f, show_date: e.target.value })}
                    style={inputStyle()}
                  />
                </div>

                <div>
                  <div style={labelStyle()}>Artista</div>
                  <select
                    value={f.artist}
                    onChange={(e) => setF({ ...f, artist: e.target.value as any })}
                    style={inputStyle()}
                  >
                    <option value="JEYF">Jey F</option>
                    <option value="ELGUDI">El Gudi</option>
                  </select>
                </div>

                <div>
                  <div style={labelStyle()}>Tipo</div>
                  <select
                    value={f.show_type}
                    onChange={(e) => setF({ ...f, show_type: e.target.value as any })}
                    style={inputStyle()}
                  >
                    <option value="SHOWCASE">Showcase</option>
                    <option value="SHOW_COMPLETO">Show completo</option>
                  </select>
                </div>
              </div>

              <div style={{ marginTop: 12 }}>
                <div style={labelStyle()}>Nombre del evento</div>
                <input
                  value={f.event_name}
                  onChange={(e) => setF({ ...f, event_name: e.target.value })}
                  placeholder="Ej: Feria / Antro / Festival..."
                  style={inputStyle()}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
                <div>
                  <div style={labelStyle()}>Venue</div>
                  <input
                    value={f.venue_name}
                    onChange={(e) => setF({ ...f, venue_name: e.target.value })}
                    placeholder="Ej: DOS28 / Foro..."
                    style={inputStyle()}
                  />
                </div>

                <div>
                  <div style={labelStyle()}>Km</div>
                  <input
                    value={f.km_distance}
                    onChange={(e) => setF({ ...f, km_distance: e.target.value })}
                    placeholder="Ej: 320"
                    style={inputStyle()}
                  />
                </div>
              </div>

              {/* Dirección con Google */}
              <div style={{ marginTop: 12 }}>
                <div style={labelStyle()}>
                  Dirección {mapsReady ? "✅" : "⏳"}
                </div>

                <input
                  ref={addressInputRef}
                  value={f.address_text}
                  onChange={(e) => {
                    setF({
                      ...f,
                      address_text: e.target.value,
                      maps_place_id: "",
                      maps_lat: "",
                      maps_lng: "",
                    });
                  }}
                  placeholder="Empieza a escribir y selecciona del dropdown..."
                  style={inputStyle()}
                  autoComplete="off"
                />

                <div style={{ marginTop: 8, opacity: 0.7, fontSize: 12 }}>
                  {f.maps_place_id ? (
                    <>
                      place_id: <b>{f.maps_place_id}</b> • lat: <b>{f.maps_lat || "-"}</b> • lng:{" "}
                      <b>{f.maps_lng || "-"}</b>
                    </>
                  ) : (
                    "Tip: selecciona una sugerencia para guardar coordenadas."
                  )}
                </div>
              </div>

              <div style={{ marginTop: 12 }}>
                <div style={labelStyle()}>Notas (opcional)</div>
                <textarea
                  value={f.notes}
                  onChange={(e) => setF({ ...f, notes: e.target.value })}
                  placeholder="Observaciones, contactos, acuerdos..."
                  style={{ ...inputStyle(), minHeight: 110, resize: "vertical" }}
                />
              </div>
            </div>

            <div style={cardStyle()}>
              <div style={{ fontWeight: 950, marginBottom: 12 }}>Hospedaje / Hospitality</div>

              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={f.hospitality}
                  onChange={(e) => setF({ ...f, hospitality: e.target.checked })}
                />
                <div style={{ fontWeight: 900 }}>Incluye hospitality</div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
                <div>
                  <div style={labelStyle()}>Hotel (opcional)</div>
                  <input
                    value={f.hotel_name}
                    onChange={(e) => setF({ ...f, hotel_name: e.target.value })}
                    placeholder="Nombre del hotel"
                    style={inputStyle()}
                  />
                </div>

                <div>
                  <div style={labelStyle()}>Habitaciones (opcional)</div>
                  <input
                    type="number"
                    value={f.rooms_count}
                    onChange={(e) => setF({ ...f, rooms_count: e.target.value })}
                    placeholder="Ej: 4"
                    style={inputStyle()}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right */}
          <div style={{ display: "grid", gap: 14, height: "fit-content" }}>
            <div style={cardStyle()}>
              <div style={{ fontWeight: 950, marginBottom: 12 }}>Montos</div>

              <div style={{ display: "grid", gap: 12 }}>
                <div>
                  <div style={labelStyle()}>Costo del show</div>
                  <input
                    value={f.show_cost}
                    onChange={(e) => setF({ ...f, show_cost: e.target.value })}
                    placeholder="Ej: 50000"
                    style={inputStyle()}
                  />
                </div>

                <div>
                  <div style={labelStyle()}>Adelanto</div>
                  <input
                    value={f.advance_paid}
                    onChange={(e) => setF({ ...f, advance_paid: e.target.value })}
                    placeholder="Ej: 15000"
                    style={inputStyle()}
                  />
                </div>

                <div>
                  <div style={labelStyle()}>Viáticos cobrados</div>
                  <input
                    value={f.viaticos_cobrados}
                    onChange={(e) => setF({ ...f, viaticos_cobrados: e.target.value })}
                    placeholder="Ej: 3000"
                    style={inputStyle()}
                  />
                </div>
              </div>
            </div>

            <div style={cardStyle()}>
              <div style={{ fontWeight: 950, marginBottom: 10 }}>Acciones</div>

              <button
                disabled={!isValid || saving}
                onClick={updateShow}
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  borderRadius: 12,
                  border: "1px solid #111827",
                  background: !isValid || saving ? "#9CA3AF" : "#111827",
                  color: "white",
                  fontWeight: 950,
                  cursor: !isValid || saving ? "not-allowed" : "pointer",
                }}
              >
                {saving ? "Guardando..." : "Guardar cambios"}
              </button>

              <button
                disabled={saving}
                onClick={deleteShow}
                style={{
                  width: "100%",
                  marginTop: 10,
                  padding: "12px 14px",
                  borderRadius: 12,
                  border: "1px solid #DC2626",
                  background: "white",
                  color: "#DC2626",
                  fontWeight: 950,
                  cursor: saving ? "not-allowed" : "pointer",
                }}
              >
                Borrar show
              </button>

              {msg && <div style={{ marginTop: 10, fontWeight: 900 }}>{msg}</div>}
              {err && <div style={{ marginTop: 6, color: "crimson" }}>{err}</div>}

              <div style={{ marginTop: 10, opacity: 0.7, fontSize: 12 }}>
                Si no aparece el dropdown: revisa Places API + Billing + referrer localhost.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
