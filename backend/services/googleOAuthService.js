const { OAuth2Client } = require("google-auth-library");

const configuredOrigins = () => String(process.env.GOOGLE_ALLOWED_ORIGINS || (process.env.NODE_ENV === "production" ? "" : "http://localhost:5173,http://127.0.0.1:5173"))
  .split(",").map(value => value.trim()).filter(Boolean);

const verifyGoogleCode = async (code, origin) => {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) throw new Error("GOOGLE_NOT_CONFIGURED");
  if (!configuredOrigins().includes(origin)) throw new Error("GOOGLE_ORIGIN_NOT_ALLOWED");
  if (typeof code !== "string" || !code.trim() || code.length > 2048) throw new Error("GOOGLE_CODE_INVALID");
  const client = new OAuth2Client(clientId, clientSecret, origin);
  const { tokens } = await client.getToken({ code, redirect_uri: origin });
  if (!tokens.id_token) throw new Error("GOOGLE_ID_TOKEN_MISSING");
  const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: clientId });
  const profile = ticket.getPayload();
  if (!profile?.sub || !profile.email || profile.email_verified !== true) throw new Error("GOOGLE_EMAIL_UNVERIFIED");
  return { sub: profile.sub, email: profile.email.trim().toLowerCase(), name: profile.name?.trim() || profile.email.split("@")[0] };
};

module.exports = { verifyGoogleCode };
