// FILE: backend/src/models/User.js
const mongoose = require('mongoose');

const SUPPORTED_AI_PROVIDERS = Object.freeze(['deepseek', 'openrouter']);

function normalizeAiApiProvider(provider) {
  const normalized = String(provider || '').trim().toLowerCase();
  if (!SUPPORTED_AI_PROVIDERS.includes(normalized)) {
    throw new Error(`Proveedor de IA no compatible: ${provider}.`);
  }
  return normalized;
}

const userSchema = new mongoose.Schema(
  {
    googleId: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true },
    name: String,
    picture: String,
    // Se conserva el campo actual para que las claves existentes no se pierdan.
    aiApiKey: { type: String, default: '' },
    // Las cuentas antiguas sin este campo se consideran legacy/deepseek hasta que
    // el usuario configure explícitamente OpenRouter desde Ajustes.
    aiApiProvider: {
      type: String,
      enum: SUPPORTED_AI_PROVIDERS,
      default: null,
    },
    aiApiKeyUpdatedAt: { type: Date, default: null },
    quickViewMaterias: [{ 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'Materia' 
    }],
    studyMetricsFilters: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    homeWidgetOrder: {
      type: [Number],
      default: [0, 1, 2, 3]
    },
    homeSectionVisibility: {
      globalStats: { type: Boolean, default: false },
      quickView: { type: Boolean, default: false },
      detailedView: { type: Boolean, default: false },
      unclassifiedDecks: { type: Boolean, default: false }
    }
  },
  { timestamps: true }
);

// Helper estático para enmascarar llaves sin exponer claves cortas completas.
userSchema.statics.maskKey = (key) => {
  const normalized = typeof key === 'string' ? key.trim() : '';
  if (!normalized) return '';
  if (normalized.length <= 4) return '•'.repeat(normalized.length);
  return '•'.repeat(normalized.length - 4) + normalized.slice(-4);
};

// Devuelve la clave activa sin exponerla en respuestas.
userSchema.methods.getAiApiKey = function getAiApiKey() {
  return typeof this.aiApiKey === 'string' ? this.aiApiKey.trim() : '';
};

userSchema.methods.hasAiApiKey = function hasAiApiKey() {
  return Boolean(this.getAiApiKey());
};

// Las claves antiguas sin proveedor se identifican como DeepSeek para permitir
// que la futura UI las elimine antes de registrar la nueva clave de OpenRouter.
userSchema.methods.getAiApiProvider = function getAiApiProvider() {
  if (!this.hasAiApiKey()) return null;
  return this.aiApiProvider || 'deepseek';
};

// Método único para guardar o editar una clave. OpenRouter es el proveedor
// predeterminado para las nuevas credenciales de este flujo.
userSchema.methods.setAiApiKey = function setAiApiKey(apiKey, provider = 'openrouter') {
  const normalizedKey = typeof apiKey === 'string' ? apiKey.trim() : '';
  if (!normalizedKey) return this.clearAiApiKey();

  this.aiApiKey = normalizedKey;
  this.aiApiProvider = normalizeAiApiProvider(provider);
  this.aiApiKeyUpdatedAt = new Date();
  return this;
};

// Método preparado para el botón de eliminar clave del apartado de Ajustes.
userSchema.methods.clearAiApiKey = function clearAiApiKey() {
  this.aiApiKey = '';
  this.aiApiProvider = null;
  this.aiApiKeyUpdatedAt = new Date();
  return this;
};

userSchema.statics.supportedAiProviders = SUPPORTED_AI_PROVIDERS;
module.exports = mongoose.model('User', userSchema);
