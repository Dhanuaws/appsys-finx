import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

const BACKEND_URL = process.env.FINX_API_URL || process.env.BACKEND_URL || "http://localhost:8000";

type Context = { params: Promise<{ path: string[] }> };

async function getAuthHeader(req: NextRequest): Promise<string> {
    const session = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    return session?.id_token ? `Bearer ${session.id_token}` : "Bearer dev-token";
}

function buildTargetUrl(path: string[], req: NextRequest): string {
    const base = `${BACKEND_URL}/${path.join("/")}`;
    const search = req.nextUrl.searchParams.toString();
    return search ? `${base}?${search}` : base;
}

export async function GET(req: NextRequest, context: Context) {
    const { path } = await context.params;
    const auth = await getAuthHeader(req);
    const url = buildTargetUrl(path, req);
    try {
        const response = await fetch(url, {
            method: "GET",
            headers: { Authorization: auth },
        });
        const data = await response.json();
        return NextResponse.json(data, { status: response.status });
    } catch (error) {
        console.error("Proxy GET error:", error);
        return NextResponse.json({ error: "Proxy error" }, { status: 500 });
    }
}

export async function POST(req: NextRequest, context: Context) {
    const { path } = await context.params;
    const auth = await getAuthHeader(req);
    const url = buildTargetUrl(path, req);
    try {
        const body = await req.json();
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: auth },
            body: JSON.stringify(body),
        });
        const data = await response.json();
        return NextResponse.json(data, { status: response.status });
    } catch (error) {
        console.error("Proxy POST error:", error);
        return NextResponse.json({ error: "Proxy error" }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest, context: Context) {
    const { path } = await context.params;
    const auth = await getAuthHeader(req);
    const url = buildTargetUrl(path, req);
    try {
        const body = await req.json();
        const response = await fetch(url, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", Authorization: auth },
            body: JSON.stringify(body),
        });
        const data = await response.json();
        return NextResponse.json(data, { status: response.status });
    } catch (error) {
        console.error("Proxy PATCH error:", error);
        return NextResponse.json({ error: "Proxy error" }, { status: 500 });
    }
}
