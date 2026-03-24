/**
 * FinX Next.js — API Route: Chat Stream Proxy
 *
 * This route sits between the Next.js app and the FastAPI backend.
 * It:
 *   1. Reads the Cognito JWT from the Next.js session
 *   2. Adds it to the Authorization header for the backend
 *   3. Streams the SSE response from the backend to the browser
 *
 * Frontend requests: POST /api/chat/stream
 * Backend receives:  POST <BACKEND_URL>/chat/stream  (with Authorization: Bearer <token>)
 */
import { NextRequest } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

export const runtime = "edge";  // Edge runtime for true streaming

export async function POST(req: NextRequest) {
    // In dev mode (DEV_MODE=true on backend), we use a dev token that the backend accepts.
    // In production, this should be a real Cognito JWT from the NextAuth session.
    const authHeader = req.headers.get("Authorization") || `Bearer dev-token`;

    const body = await req.json().catch(() => ({ message: "", audit_mode: false }));

    // Validate minimal input
    if (!body.message || typeof body.message !== "string" || body.message.trim().length === 0) {
        return new Response(JSON.stringify({ error: "Message is required" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
        });
    }

    // Forward to FastAPI backend with SSE
    let backendResponse: Response;
    try {
        backendResponse = await fetch(`${BACKEND_URL}/chat/stream`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: authHeader,
                "X-Request-ID": req.headers.get("X-Request-ID") || crypto.randomUUID(),
            },
            body: JSON.stringify({
                message: body.message.trim().slice(0, 4000), // hard limit
                audit_mode: Boolean(body.audit_mode),
                conversation_id: body.conversation_id ?? null,
                conversation_history: body.conversation_history || [],
            }),
            // @ts-expect-error — duplex required in Node edge streams
            duplex: "half",
        });
    } catch (err) {
        console.error("[/api/chat/stream] Backend unreachable:", err);
        return new Response(
            `data: ${JSON.stringify({ type: "chunk", text: "⚠️ Backend is unavailable. Please check your connection." })}\n\ndata: ${JSON.stringify({ type: "done" })}\n\n`,
            {
                status: 200,
                headers: {
                    "Content-Type": "text/event-stream",
                    "Cache-Control": "no-cache",
                    Connection: "keep-alive",
                },
            }
        );
    }

    if (!backendResponse.ok) {
        const err = await backendResponse.text();
        console.error("[/api/chat/stream] Backend error:", backendResponse.status, err);
        return new Response(
            `data: ${JSON.stringify({ type: "chunk", text: `Backend error (${backendResponse.status}).` })}\n\ndata: ${JSON.stringify({ type: "done" })}\n\n`,
            {
                status: 200,
                headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
            }
        );
    }

    // Stream body direct to client
    return new Response(backendResponse.body, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            Connection: "keep-alive",
        },
    });
}
