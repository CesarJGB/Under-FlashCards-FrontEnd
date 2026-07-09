const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const oauthClient = new OAuth2Client(GOOGLE_CLIENT_ID);

exports.googleAuth = async (req, res) => {
  try {
    const idToken = req.body?.credential || req.body?.token;
    if (!idToken) {
      return res.status(400).json({ error: 'Missing Google credential token.' });
    }

    const ticket = await oauthClient.verifyIdToken({
      idToken,
      audience: GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();

    if (!payload || payload.aud !== GOOGLE_CLIENT_ID) {
      return res.status(401).json({ error: 'Token audience mismatch.' });
    }
    if (payload.email_verified === false) {
      return res.status(401).json({ error: 'Google email is not verified.' });
    }

    const user = await User.findOneAndUpdate(
      { googleId: payload.sub },
      {
        $set: { email: payload.email, name: payload.name, picture: payload.picture },
        $setOnInsert: { googleId: payload.sub },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    return res.json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        picture: user.picture,
        hasApiKey: !!user.aiApiKey,
      },
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

    return res.json({
      id: user._id,
      email: user.email,
      name: user.name,
      picture: user.picture,
      hasApiKey: !!user.aiApiKey,
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
      { new: true }
    );
    if (!user) return res.status(404).json({ error: 'User not found.' });

    return res.json({
      success: true,
      hasApiKey: !!user.aiApiKey,
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
    
    // Si no tiene llave guardada, retornamos limpio sin intentar llamar a DeepSeek
    if (!user.aiApiKey) {
      return res.json({ hasBalance: false });
    }

    // Consultamos directo al endpoint de fondos de DeepSeek
    const response = await fetch('https://api.deepseek.com/user/balance', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${user.aiApiKey}`
      }
    });

    if (!response.ok) {
      return res.status(502).json({ error: 'No se pudo sincronizar el saldo con DeepSeek.' });
    }

    const balanceData = await response.json();
    
    return res.json({
      hasBalance: true,
      isAvailable: balanceData.is_available,
      // DeepSeek devuelve un arreglo "balance_infos". Tomamos el principal.
      info: balanceData.balance_infos?.[0] || null
    });

  } catch (err) {
    console.error('[user/balance] error:', err.message);
    return res.status(500).json({ error: 'Server error al consultar fondos.' });
  }
};

// Middleware de protección (protect)
// Verifica un token de Google ID (Bearer <idToken>) o acepta X-User-Id en entornos de desarrollo.
exports.protect = async (req, res, next) => {
  try {
    // Intentar extraer token desde Authorization Bearer, x-access-token o body.token
    const authHeader = req.headers.authorization || req.headers['x-access-token'];
    let token = null;
    if (authHeader) token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
    if (!token && req.body?.token) token = req.body.token;

    // Dev fallback: permitir pasar X-User-Id para facilitar pruebas locales (no recomendado en prod)
    const devUserId = req.headers['x-user-id'] || req.body?.userId;
    if (!token && devUserId) {
      const user = await User.findById(devUserId);
      if (!user) return res.status(401).json({ error: 'Usuario no encontrado (x-user-id).' });
      req.user = user;
      return next();
    }

    if (!token) return res.status(401).json({ error: 'Token de autenticación ausente.' });

    const ticket = await oauthClient.verifyIdToken({ idToken: token, audience: GOOGLE_CLIENT_ID });
    const payload = ticket.getPayload();
    if (!payload) return res.status(401).json({ error: 'Token inválido.' });

    // Buscar usuario por googleId; si no existe, crear uno mínimo
    let user = await User.findOne({ googleId: payload.sub });
    if (!user) {
      user = await User.create({ googleId: payload.sub, email: payload.email, name: payload.name, picture: payload.picture });
    }
    req.user = user;
    return next();
  } catch (err) {
    console.error('[auth:protect] error:', err.message);
    return res.status(401).json({ error: 'No autorizado.' });
  }
};
