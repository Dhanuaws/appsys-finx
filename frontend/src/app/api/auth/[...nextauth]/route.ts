import NextAuth from "next-auth";
import CognitoProvider from "next-auth/providers/cognito";

const handler = NextAuth({
    providers: [
        CognitoProvider({
            clientId: process.env.COGNITO_CLIENT_ID as string,
            clientSecret: process.env.COGNITO_CLIENT_SECRET as string,
            issuer: process.env.COGNITO_ISSUER as string,
        }),
    ],
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
