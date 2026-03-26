import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

export const runtime = 'edge';

export async function POST(
    req: NextRequest,
    { params }: { params: { path: string[] } }
) {
    const session = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

    // Validate authentication explicitly
    if (!session || !session.id_token) {
        return NextResponse.json({ error: "Unauthorized. Missing IAM session." }, { status: 401 });
    }

    const { path } = params;
    const targetPath = path.join("/");
    const apiUrl = `${process.env.FINX_API_URL || "http://localhost:8000"}/${targetPath}`;

    try {
        const body = await req.json();

        // Proxy the request to the FastAPI backend with the securely retrieved Cognito ID Token
        const response = await fetch(apiUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${session.id_token}`,
            },
            body: JSON.stringify(body),
        });

        const data = await response.json();

        if (!response.ok) {
            return NextResponse.json(data, { status: response.status });
        }

        return NextResponse.json(data);
    } catch (error: any) {
        console.error("Proxy Error:", error);
        return NextResponse.json(
            { error: "Internal Server Proxy Error" },
            { status: 500 }
        );
    }
}
