"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  value: string;
  onChange: (address: string) => void;
  onKmCalculated: (km: string) => void; // 👈 nuevo
};

export default function AddressAutocomplete({
  value,
  onChange,
  onKmCalculated,
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  const [loadingKm, setLoadingKm] = useState(false);

  useEffect(() => {
    if (!window.google || !inputRef.current) return;

    // Evita inicializar dos veces
    if (autocompleteRef.current) return;

    autocompleteRef.current = new google.maps.places.Autocomplete(
      inputRef.current,
      {
        types: ["geocode"],
        componentRestrictions: { country: "mx" },
        fields: ["formatted_address", "place_id"],
      }
    );

    autocompleteRef.current.addListener("place_changed", async () => {
      const place = autocompleteRef.current?.getPlace();
      const address = place?.formatted_address || "";
      const placeId = place?.place_id || "";

      if (!address) return;

      // 1️⃣ Mandamos la dirección al form
      onChange(address);

      // 2️⃣ Calculamos KM automático
      try {
        setLoadingKm(true);

        const res = await fetch("/api/distance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            destinationPlaceId: placeId,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          console.error("Error KM:", data);
          return;
        }

        // 3️⃣ Mandamos el KM al form
        if (data?.km != null) {
          onKmCalculated(String(data.km));
        }
      } catch (err) {
        console.error("Error calculando KM", err);
      } finally {
        setLoadingKm(false);
      }
    });
  }, [onChange, onKmCalculated]);

  return (
    <div>
      <input
        ref={inputRef}
        type="text"
        placeholder="Empieza a escribir la dirección..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%",
          padding: "10px",
          borderRadius: 8,
          border: "1px solid #ddd",
        }}
      />

      {loadingKm && (
        <div style={{ fontSize: 12, marginTop: 6, opacity: 0.7 }}>
          Calculando km...
        </div>
      )}
    </div>
  );
}
