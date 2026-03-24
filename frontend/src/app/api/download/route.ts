import { NextRequest } from "next/server";

export const runtime = "edge";

const BACKEND_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_FINX_API_URL || "http://localhost:8000";

export async function GET(req: NextRequest) {
    const s3Key = req.nextUrl.searchParams.get("s3_key");
    if (!s3Key) {
        return new Response(JSON.stringify({ error: "s3_key is required" }), { status: 400 });
    }

    const authHeader = req.headers.get("Authorization") || `Bearer dev-token`;

    try {
        const res = await fetch(`${BACKEND_URL}/evidence/attachment/signed-url?s3_key=${encodeURIComponent(s3Key)}`, {
            headers: { Authorization: authHeader }
        });

        if (!res.ok) {
            return new Response(await res.text(), { status: res.status });
        }

        const data = await res.json();
        return new Response(JSON.stringify(data), {
            status: 200,
            headers: { "Content-Type": "application/json" }
        });
    } catch (e) {
        return new Response(JSON.stringify({ error: "Failed to reach backend." }), { status: 502 });
    }
}
