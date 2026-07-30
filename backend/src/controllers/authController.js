// FILE: backend/src/controllers/authController.cambio.de.provedor.js
const { randomInt } = require('node:crypto');
const { OAuth2Client } = require('google-auth-library');
const InviteCode = require('../models/InviteCode');
const User = require('../models/User');

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'cesarjaviervebe@gmail.com';
const oauthClient = new OAuth2Client(GOOGLE_CLIENT_ID);

const OPENROUTER_KEY_URL = 'https://openrouter.ai/api/v1/key';
const OPENROUTER_MODEL = 'deepseek/deepseek-v4-flash';
const OPENROUTER_PROVIDER = 'openrouter';
const LEGACY_DEEPSEEK_PROVIDER = 'deepseek';
const SUPPORTED_AI_PROVIDERS = new Set([
  LEGACY_DEEPSEEK_PROVIDER,
  OPENROUTER_PROVIDER,
]);
const OPENROUTER_BALANCE_TIMEOUT_MS = 15000;

function isAdminUser(user) {
  return user?.email === ADMIN_EMAIL;
}

async function resolveInviteAccess(user) {
  if (isAdminUser(user)) {
    return { hasAccess: true, needsInvite: false };
  }

  const activeInvite = await InviteCode.findOne({
    redeemedByGoogleId: user.googleId,
    status: 'active',
  });

  return { hasAccess: Boolean(activeInvite), needsInvite: !activeInvite };
}

async function verifyGooglePayload(token) {
  const ticket = await oauthClient.verifyIdToken({
    idToken: token,
    audience: GOOGLE_CLIENT_ID,
  });
  const payload = ticket.getPayload();

  if (!payload || payload.aud !== GOOGLE_CLIENT_ID) {
    throw new Error('Token audience mismatch.');
  }
  if (payload.email_verified === false) {
    throw new Error('Google email is not verified.');
  }

  return payload;
}

async function verifyGoogleIdTokenAndGetUser(token) {
  const payload = await verifyGooglePayload(token);

  return User.findOneAndUpdate(
    { googleId: payload.sub },
    {
      $set: { email: payload.email, name: payload.name, picture: payload.picture },
      $setOnInsert: { googleId: payload.sub },
    },
    { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true }
  );
}

function normalizeAiApiProvider(provider) {
  const normalized = String(provider || '').trim().toLowerCase();
  return normalized || null;
}

function getAiApiKey(user) {
  if (!user) return '';

  if (typeof user.getAiApiKey === 'function') {
    return user.getAiApiKey();
  }

  return typeof user.aiApiKey === 'string' ? user.aiApiKey.trim() : '';
}

function getAiApiProvider(user) {
  if (!getAiApiKey(user)) return null;

  if (typeof user.getAiApiProvider === 'function') {
    const methodProvider = normalizeAiApiProvider(user.getAiApiProvider());
    if (SUPPORTED_AI_PROVIDERS.has(methodProvider)) return methodProvider;
  }

  const storedProvider = normalizeAiApiProvider(user.aiApiProvider);
  return SUPPORTED_AI_PROVIDERS.has(storedProvider)
    ? storedProvider
    : LEGACY_DEEPSEEK_PROVIDER;
}

function maskApiKey(key) {
  const normalized = typeof key === 'string' ? key.trim() : '';
  if (!normalized) return '';
  if (normalized.length <= 4) return '•'.repeat(normalized.length);
  return '•'.repeat(normalized.length - 4) + normalized.slice(-4);
}

function serializeUser(user, access) {
  return {
    id: user._id,
    email: user.email,
    name: user.name,
    picture: user.picture,
    hasApiKey: Boolean(getAiApiKey(user)),
    aiApiProvider: getAiApiProvider(user),
    isAdmin: isAdminUser(user),
    hasAccess: access.hasAccess,
    needsInvite: access.needsInvite,
  };
}

exports.googleAuth = async (req, res) => {
  try {
    const idToken = req.body?.credential || req.body?.token;
    if (!idToken) {
      return res.status(400).json({ error: 'Missing Google credential token.' });
    }

    const user = await verifyGoogleIdTokenAndGetUser(idToken);
    const access = await resolveInviteAccess(user);

    return res.json({
      success: true,
      needsInvite: access.needsInvite,
      user: serializeUser(user, access),
    });
  } catch (err) {
    console.error('[auth/google] Verification failed:', err.message);
    return res.status(401).json({ error: 'Invalid or expired Google token.' });
  }
};

exports.getUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    const access = await resolveInviteAccess(user);

    return res.json({
      ...serializeUser(user, access),
      apiKeyMasked: maskApiKey(getAiApiKey(user)),
    });
  } catch (err) {
    console.error('[user] error:', err.message);
    return res.status(500).json({ error: 'Server error.' });
  }
};

exports.updateSettings = async (req, res) => {
  try {
    const { userId, aiApiKey, aiApiProvider } = req.body || {};
    if (typeof userId !== 'string' || !userId.trim()) {
      return res.status(400).json({ error: 'userId is required.' });
    }
    if (typeof aiApiKey !== 'string') {
      return res.status(400).json({ error: 'aiApiKey must be a string.' });
    }

    const normalizedKey = aiApiKey.trim();
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    if (!normalizedKey) {
      if (typeof user.clearAiApiKey === 'function') {
        user.clearAiApiKey();
      } else {
        user.aiApiKey = '';
        user.aiApiProvider = null;
        user.aiApiKeyUpdatedAt = new Date();
      }
    } else {
      // Las nuevas claves se consideran OpenRouter si el cliente no envía el
      // proveedor. El frontend migrado lo envía explícitamente.
      const requestedProvider = normalizeAiApiProvider(aiApiProvider);
      const provider = requestedProvider || OPENROUTER_PROVIDER;

      if (!SUPPORTED_AI_PROVIDERS.has(provider)) {
        return res.status(400).json({
          error: 'aiApiProvider must be deepseek or openrouter.',
        });
      }

      if (typeof user.setAiApiKey === 'function') {
        user.setAiApiKey(normalizedKey, provider);
      } else {
        user.aiApiKey = normalizedKey;
        user.aiApiProvider = provider;
        user.aiApiKeyUpdatedAt = new Date();
      }
    }

    await user.save();

    const savedKey = getAiApiKey(user);
    return res.json({
      success: true,
      hasApiKey: Boolean(savedKey),
      aiApiProvider: getAiApiProvider(user),
      apiKeyMasked: maskApiKey(savedKey),
    });
  } catch (err) {
    console.error('[user/settings] error:', err.message);
    return res.status(500).json({ error: 'Server error.' });
  }
};

function toNullableNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeOpenRouterKeyInfo(data) {
  return {
    label: typeof data.label === 'string' ? data.label : null,
    limit: toNullableNumber(data.limit),
    limit_remaining: toNullableNumber(data.limit_remaining),
    limit_reset: typeof data.limit_reset === 'string' ? data.limit_reset : null,
    // Alias útil para clientes que esperan una fecha o campo con este nombre.
    limit_reset_at: typeof data.limit_reset_at === 'string'
      ? data.limit_reset_at
      : null,
    usage: toNullableNumber(data.usage),
    usage_daily: toNullableNumber(data.usage_daily),
    usage_weekly: toNullableNumber(data.usage_weekly),
    usage_monthly: toNullableNumber(data.usage_monthly),
    byok_usage: toNullableNumber(data.byok_usage),
    byok_usage_daily: toNullableNumber(data.byok_usage_daily),
    byok_usage_weekly: toNullableNumber(data.byok_usage_weekly),
    byok_usage_monthly: toNullableNumber(data.byok_usage_monthly),
    include_byok_in_limit: data.include_byok_in_limit === true,
    is_free_tier: data.is_free_tier === true,
    currency: 'USD',
  };
}

function getOpenRouterErrorMessage(payload) {
  const providerMessage = payload?.error?.message;
  return typeof providerMessage === 'string' && providerMessage.trim()
    ? providerMessage.trim().slice(0, 300)
    : null;
}

async function fetchOpenRouterKeyInfo(apiKey) {
  const headers = {
    Accept: 'application/json',
    Authorization: 'Bearer ' + apiKey,
  };
  const siteUrl = process.env.OPENROUTER_SITE_URL?.trim();
  const appName = process.env.OPENROUTER_APP_NAME?.trim();
  if (siteUrl) headers['HTTP-Referer'] = siteUrl;
  if (appName) headers['X-OpenRouter-Title'] = appName;

  const controller = typeof AbortController === 'function'
    ? new AbortController()
    : null;
  const timeoutId = controller
    ? setTimeout(() => controller.abort(), OPENROUTER_BALANCE_TIMEOUT_MS)
    : null;

  try {
    const response = await fetch(OPENROUTER_KEY_URL, {
      method: 'GET',
      headers,
      signal: controller?.signal,
    });
    const responseText = await response.text();
    let payload = null;

    if (responseText.trim()) {
      try {
        payload = JSON.parse(responseText);
      } catch {
        payload = null;
      }
    }

    if (!response.ok) {
      const error = new Error(
        getOpenRouterErrorMessage(payload) || 'OpenRouter rechazó la consulta del saldo.'
      );
      error.isOpenRouterError = true;
      error.status = response.status;
      throw error;
    }

    if (!payload?.data || typeof payload.data !== 'object' || Array.isArray(payload.data)) {
      const error = new Error('OpenRouter devolvió una respuesta de saldo inválida.');
      error.isOpenRouterError = true;
      error.status = 502;
      throw error;
    }

    return payload.data;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

exports.getAiBalance = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });

    const apiKey = getAiApiKey(user);
    const provider = getAiApiProvider(user);
    if (!apiKey) {
      return res.json({
        hasBalance: false,
        isAvailable: false,
        aiApiProvider: null,
        info: null,
      });
    }

    // Una clave antigua de DeepSeek no es válida en OpenRouter. Se devuelve
    // una respuesta controlada para que la UI pueda pedir su eliminación sin
    // presentar el fallo como un error de saldo de OpenRouter.
    if (provider !== OPENROUTER_PROVIDER) {
      return res.json({
        hasBalance: false,
        isAvailable: false,
        aiApiProvider: provider,
        reason: provider === LEGACY_DEEPSEEK_PROVIDER
          ? 'legacy_provider'
          : 'unsupported_provider',
        info: null,
      });
    }

    const balanceData = await fetchOpenRouterKeyInfo(apiKey);

    return res.json({
      hasBalance: true,
      isAvailable: true,
      aiApiProvider: OPENROUTER_PROVIDER,
      provider: OPENROUTER_PROVIDER,
      model: OPENROUTER_MODEL,
      info: normalizeOpenRouterKeyInfo(balanceData),
    });
  } catch (err) {
    console.error('[user/balance] error:', err.message);

    if (err?.name === 'AbortError') {
      return res.status(504).json({
        error: 'OpenRouter tardó demasiado en responder al consultar el saldo.',
      });
    }

    if (err?.isOpenRouterError) {
      if (err.status === 401) {
        return res.status(502).json({
          error: 'La clave de OpenRouter no es válida o fue revocada.',
        });
      }
      if (err.status === 429) {
        return res.status(502).json({
          error: 'OpenRouter limitó temporalmente la consulta del saldo.',
        });
      }
      return res.status(502).json({
        error: 'No se pudo sincronizar el saldo con OpenRouter.',
      });
    }

    return res.status(500).json({ error: 'Server error al consultar fondos.' });
  }
};

exports.redeemInvite = async (req, res) => {
  try {
    const idToken = req.body?.credential || req.body?.token;
    const rawCode = req.body?.code;

    if (!idToken) return res.status(400).json({ error: 'Falta el token de Google.' });
    if (!rawCode || typeof rawCode !== 'string') {
      return res.status(400).json({ error: 'Falta el código de invitación.' });
    }

    const code = rawCode.trim().toUpperCase();
    const user = await verifyGoogleIdTokenAndGetUser(idToken);
    const invite = await InviteCode.findOne({ code });

    if (!invite) {
      return res.status(404).json({ error: 'Código de invitación no válido.' });
    }

    if (invite.status === 'revoked') {
      return res.status(403).json({ error: 'Este código fue revocado.' });
    }

    if (invite.status === 'active' && invite.redeemedByGoogleId !== user.googleId) {
      return res.status(409).json({ error: 'Este código ya está en uso.' });
    }

    if (invite.status === 'unused') {
      const claimedInvite = await InviteCode.findOneAndUpdate(
        { _id: invite._id, status: 'unused' },
        {
          $set: {
            status: 'active',
            redeemedByGoogleId: user.googleId,
            redeemedByEmail: user.email,
            redeemedAt: new Date(),
          },
        },
        { returnDocument: 'after' }
      );

      if (!claimedInvite) {
        return res.status(409).json({ error: 'Este código ya está en uso.' });
      }
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('[auth/redeem-invite] error:', err.message);
    return res.status(401).json({ error: 'No se pudo validar el código.' });
  }
};

function generateRandomCode(length = 8) {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  return Array.from({ length }, () => alphabet[randomInt(alphabet.length)]).join('');
}

exports.generateInviteCode = async (req, res) => {
  try {
    const { label } = req.body || {};
    let code;

    for (let attempts = 0; attempts < 5; attempts += 1) {
      const candidate = generateRandomCode();
      const exists = await InviteCode.findOne({ code: candidate });
      if (!exists) {
        code = candidate;
        break;
      }
    }

    if (!code) return res.status(500).json({ error: 'No se pudo generar un código único.' });

    const invite = await InviteCode.create({
      code,
      label: typeof label === 'string' ? label.trim() : '',
    });

    return res.json({ success: true, invite });
  } catch (err) {
    console.error('[admin/invite/generate] error:', err.message);
    return res.status(500).json({ error: 'Server error.' });
  }
};

exports.listInviteCodes = async (req, res) => {
  try {
    const invites = await InviteCode.find().sort({ createdAt: -1 });
    return res.json({ invites });
  } catch (err) {
    console.error('[admin/invite/list] error:', err.message);
    return res.status(500).json({ error: 'Server error.' });
  }
};

exports.revokeInviteCode = async (req, res) => {
  try {
    const { id } = req.params;
    const invite = await InviteCode.findByIdAndUpdate(
      id,
      { $set: { status: 'revoked' } },
      { returnDocument: 'after' }
    );

    if (!invite) return res.status(404).json({ error: 'Código no encontrado.' });
    return res.json({ success: true, invite });
  } catch (err) {
    console.error('[admin/invite/revoke] error:', err.message);
    return res.status(500).json({ error: 'Server error.' });
  }
};

exports.reactivateInviteCode = async (req, res) => {
  try {
    const { id } = req.params;
    const invite = await InviteCode.findById(id);
    if (!invite) return res.status(404).json({ error: 'Código no encontrado.' });
    if (!invite.redeemedByGoogleId) {
      return res.status(400).json({ error: 'Este código nunca fue canjeado; no hay nada que reactivar.' });
    }

    invite.status = 'active';
    await invite.save();
    return res.json({ success: true, invite });
  } catch (err) {
    console.error('[admin/invite/reactivate] error:', err.message);
    return res.status(500).json({ error: 'Server error.' });
  }
};

// Verifica un token de Google ID y exige que la cuenta tenga un código de
// invitación activo. El bypass de desarrollo solo evita verificar el token.
exports.protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || req.headers['x-access-token'];
    let token = null;
    if (authHeader) token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
    if (!token && req.body?.token) token = req.body.token;

    // El bypass de desarrollo es opt-in y no debe habilitarse en producción.
    const devUserId = req.headers['x-user-id'] || req.body?.userId;
    if (!token && devUserId && process.env.ALLOW_DEV_USER_ID === 'true') {
      const user = await User.findById(devUserId);
      if (!user) return res.status(401).json({ error: 'Usuario no encontrado (x-user-id).' });

      const { hasAccess } = await resolveInviteAccess(user);
      if (!hasAccess) {
        return res.status(403).json({
          error: 'Acceso no autorizado. Se requiere código de invitación.',
          code: 'INVITE_REQUIRED',
        });
      }

      req.user = user;
      return next();
    }

    if (!token) return res.status(401).json({ error: 'Token de autenticación ausente.' });

    const user = await verifyGoogleIdTokenAndGetUser(token);
    const { hasAccess } = await resolveInviteAccess(user);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Acceso no autorizado. Se requiere código de invitación.',
        code: 'INVITE_REQUIRED',
      });
    }

    req.user = user;
    return next();
  } catch (err) {
    console.error('[auth:protect] error:', err.message);
    return res.status(401).json({ error: 'No autorizado.' });
  }
};

exports.requireAdmin = (req, res, next) => {
  if (!isAdminUser(req.user)) {
    return res.status(403).json({ error: 'Solo un administrador puede hacer esto.' });
  }
  return next();
};
