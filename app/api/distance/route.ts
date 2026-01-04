import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Falta GOOGLE_MAPS_API_KEY en .env.local" }, { status: 500 });
    }

    const originAddress = "El Morro, Boca del Río, Veracruz, México";

    const destination =
      body?.destinationPlaceId
        ? { placeId: body.destinationPlaceId }
        : body?.destinationAddress
          ? { address: body.destinationAddress }
          : null;

    if (!destination) {
      return NextResponse.json(
        { error: "Manda destinationPlaceId o destinationAddress" },
        { status: 400 }
      );
    }

    const googleRes = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,

        // ESTO ES OBLIGATORIO:
        "X-Goog-FieldMask": "routes.distanceMeters",
      },
      body: JSON.stringify({
        origin: { address: originAddress },
        destination,
        travelMode: "DRIVE",
        units: "METRIC",
      }),
    });

    const data = await googleRes.json();

    if (!googleRes.ok) {
      return NextResponse.json(
        { error: "Google Routes API error", details: data, status: googleRes.status },
        { status: 500 }
      );
    }

    const meters = data?.routes?.[0]?.distanceMeters;
    if (typeof meters !== "number") {
      return NextResponse.json({ error: "No llegó distanceMeters", details: data }, { status: 500 });
    }

    const km = Math.round((meters / 1000) * 100) / 100;
    return NextResponse.json({ km, meters });
  } catch (e: any) {
    return NextResponse.json({ error: "Server error", details: String(e?.message || e) }, { status: 500 });
  }
}
