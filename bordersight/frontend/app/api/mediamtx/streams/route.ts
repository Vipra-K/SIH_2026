import { NextResponse } from "next/server";

const MEDIAMTX_API = process.env.MEDIAMTX_API_URL ?? "http://127.0.0.1:9997";

type MediaMtxPath = {
  name: string;
  online?: boolean;
  ready?: boolean;
  available?: boolean;
  tracks?: string[];
};

export async function GET() {
  try {
    const response = await fetch(`${MEDIAMTX_API}/v3/paths/list`, {
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `MediaMTX returned ${response.status}` },
        { status: 502 }
      );
    }

    const data = (await response.json()) as { items?: MediaMtxPath[] };
    const streams = (data.items ?? [])
      .filter((stream) => stream.online !== false && stream.ready !== false)
      .map((stream) => ({
        name: stream.name,
        online: stream.online !== false,
        ready: stream.ready !== false,
        tracks: stream.tracks ?? [],
      }))
      .sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { numeric: true })
      );

    return NextResponse.json({ items: streams });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? `Could not reach MediaMTX: ${error.message}`
            : "Could not reach MediaMTX",
      },
      { status: 502 }
    );
  }
}
