import NextAuth from "next-auth";
import CognitoProvider from "next-auth/providers/cognito";

const handler = NextAuth({
    providers: [
        ...(process.env.COGNITO_CLIENT_ID && process.env.COGNITO_CLIENT_SECRET && process.env.COGNITO_ISSUER
            ? [CognitoProvider({
                clientId: process.env.COGNITO_CLIENT_ID,
                clientSecret: process.env.COGNITO_CLIENT_SECRET,
                issuer: process.env.COGNITO_ISSUER,
            })]
            : []
        ),
    ],
    pages: {
        signIn: "/api/auth/signin",
        error: "/api/auth/error",
    },
    callbacks: {
        async jwt({ token, account }) {
            // Persist the raw Cognito ID Token to the token right after signin
            if (account) {
                token.idToken = account.id_token;
            }
            return token;
        },
        async session({ session, token }) {
            // Send the ID token properties to the client, like the raw token
            // so we can forward it to the Python backend
            if (session.user) {
                (session as any).idToken = token.idToken;
            }
            return session;
        },
    },
});

export { handler as GET, handler as POST };
