// =============================================================================
// Flashcards MVP - Backend (Node.js + Express)
// Secure Google Sign-In verification endpoint.
//
// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS,
// THIS BREAKS THE AUTH. All config comes from environment variables (.env).
// =============================================================================

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { OAuth2Client } = require('google-auth-library');

const app = express();

const PORT = process.env.PORT || 8001;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;

// Fail fast if the most critical security variable is missing.
if (!GOOGLE_CLIENT_ID) {
  console.error('[FATAL] GOOGLE_CLIENT_ID is not defined. Set it in your .env file.');
}

// Single reusable OAuth client. Passing the client id here also makes it the
// default audience used during token verification.
const oauthClient = new OAuth2Client(GOOGLE_CLIENT_ID);

// -----------------------------------------------------------------------------
// CORS: explicit allow-list.
// FRONTEND_URL may contain a comma-separated list of allowed origins
// (e.g. your Cloudflare Pages domain). Localhost dev ports are always allowed.
// -----------------------------------------------------------------------------
const configuredOrigins = (process.env.FRONTEND_URL || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const devOrigins = ['http://localhost:3000', 'http://localhost:5173'];
const allowedOrigins = [...new Set([...configuredOrigins, ...devOrigins])];

const corsOptions = {
  origin(origin, callback) {
    // Allow non-browser clients (curl, health checks) that send no Origin header.
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  methods: ['GET', 'POST'],
  credentials: true,
};

app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json({ limit: '1mb' }));

// -----------------------------------------------------------------------------
// Health check
// -----------------------------------------------------------------------------
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'flashcards-backend' });
});

// -----------------------------------------------------------------------------
// POST /api/auth/google
// Receives the Google credential (idToken JWT) from the frontend, verifies it
// against Google's public keys, validates the audience (clientId), and returns
// the trusted user profile.
// -----------------------------------------------------------------------------
app.post('/api/auth/google', async (req, res) => {
  try {
    const idToken = req.body?.credential || req.body?.token;

    if (!idToken) {
      return res.status(400).json({ error: 'Missing Google credential token.' });
    }

    // Verifies signature, expiry AND that the token audience === our clientId.
    const ticket = await oauthClient.verifyIdToken({
      idToken,
      audience: GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    // Defense in depth: re-assert the audience match explicitly.
    if (!payload || payload.aud !== GOOGLE_CLIENT_ID) {
      return res.status(401).json({ error: 'Token audience mismatch.' });
    }

    // Only trust verified Google emails.
    if (payload.email_verified === false) {
      return res.status(401).json({ error: 'Google email is not verified.' });
    }

    const user = {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
    };

    return res.json({ success: true, user });
  } catch (err) {
    // Never leak internal details to the client.
    console.error('[auth/google] Verification failed:', err.message);
    return res.status(401).json({ error: 'Invalid or expired Google token.' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Flashcards backend listening on port ${PORT}`);
  console.log(`Allowed CORS origins: ${allowedOrigins.join(', ')}`);
});
