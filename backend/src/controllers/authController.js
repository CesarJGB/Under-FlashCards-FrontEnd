const { randomInt } = require('node:crypto');
const { OAuth2Client } = require('google-auth-library');
const InviteCode = require('../models/InviteCode');
const User = require('../models/User');

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'cesarjaviervebe@gmail.com';
const oauthClient = new OAuth2Client(GOOGLE_CLIENT_ID);

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

function serializeUser(user, access) {
  return {
    id: user._id,
    email: user.email,
    name: user.name,
    picture: user.picture,
    hasApiKey: Boolean(user.aiApiKey),
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
      apiKeyMasked: User.maskKey(user.aiApiKey),
    });
  } catch (err) {
    console.error('[user] error:', err.message);
    return res.status(500).json({ error: 'Server error.' });
  }
};

exports.updateSettings = async (req, res) => {
  try {
    const { userId, aiApiKey } = req.body || {};
    if (typeof aiApiKey !== 'string') {
      return res.status(400).json({ error: 'aiApiKey must be a string.' });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: { aiApiKey: aiApiKey.trim() } },
      { returnDocument: 'after' }
    );
    if (!user) return res.status(404).json({ error: 'User not found.' });

    return res.json({
      success: true,
      hasApiKey: Boolean(user.aiApiKey),
      apiKeyMasked: User.maskKey(user.aiApiKey),
    });
  } catch (err) {
    console.error('[user/settings] error:', err.message);
    return res.status(500).json({ error: 'Server error.' });
  }
};

exports.getAiBalance = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });

    if (!user.aiApiKey) {
      return res.json({ hasBalance: false });
    }

    const response = await fetch('https://api.deepseek.com/user/balance', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${user.aiApiKey}`,
      },
    });

    if (!response.ok) {
      return res.status(502).json({ error: 'No se pudo sincronizar el saldo con DeepSeek.' });
    }

    const balanceData = await response.json();

    return res.json({
      hasBalance: true,
      isAvailable: balanceData.is_available,
      info: balanceData.balance_infos?.[0] || null,
    });
  } catch (err) {
    console.error('[user/balance] error:', err.message);
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
