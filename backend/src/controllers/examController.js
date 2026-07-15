const mongoose = require('mongoose');
const Exam = require('../models/Exam');
const Question = require('../models/Question');
const ExamAttempt = require('../models/ExamAttempt');
const ExamFolder = require('../models/ExamFolder');
const Deck = require('../models/Deck');
const Flashcard = require('../models/Flashcard');
const User = require('../models/User');

const MAX_QUESTIONS = 100;
const MAX_TEXT_LENGTH = 10000;
const MAX_OPEN_ANSWER_LENGTH = 5000;
const AI_REASONER_THRESHOLD = parseInt(process.env.AI_REASONER_THRESHOLD, 10) || 20;

const QUESTION_TYPES = ['multiple_choice', 'true_false', 'open'];
const QUESTION_TYPE_ALIASES = {
  multiple_choice: 'multiple_choice',
  'multiple-choice': 'multiple_choice',
  multiplechoice: 'multiple_choice',
  mc: 'multiple_choice',
  true_false: 'true_false',
  'true-false': 'true_false',
  'true/false': 'true_false',
  truefalse: 'true_false',
  tf: 'true_false',
  open: 'open',
  open_ended: 'open',
  'open-ended': 'open',
};

class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function isValidId(value) {
  return value !== undefined && value !== null && mongoose.Types.ObjectId.isValid(value);
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value || {}, key);
}

function sameId(first, second) {
  return String(first) === String(second);
}

function getRequestUserId(req) {
  if (req.body?.userId !== undefined) return req.body.userId;
  return req.query?.userId;
}

function requireUserId(req) {
  const userId = getRequestUserId(req);
  if (!isValidId(userId)) {
    throw new ApiError(400, 'Usuario inválido.');
  }
  return userId;
}

function requireText(value, field, maxLength = MAX_TEXT_LENGTH) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new ApiError(400, `${field} es obligatorio.`);
  }
  const text = value.trim();
  if (text.length > maxLength) {
    throw new ApiError(400, `${field} supera el tamaño máximo permitido.`);
  }
  return text;
}

function normalizeQuestionType(value) {
  if (typeof value !== 'string') {
    throw new ApiError(400, 'El tipo de pregunta es inválido.');
  }
  const normalized = QUESTION_TYPE_ALIASES[value.trim().toLowerCase()];
  if (!normalized) {
    throw new ApiError(400, `El tipo de pregunta debe ser uno de: ${QUESTION_TYPES.join(', ')}.`);
  }
  return normalized;
}

function normalizeSourceType(value) {
  if (value !== 'scratch' && value !== 'from_deck') {
    throw new ApiError(400, 'sourceType debe ser "scratch" o "from_deck".');
  }
  return value;
}

function normalizeOrder(value, fallback) {
  if (value === undefined) return fallback;
  if (!Number.isInteger(value) || value < 0) {
    throw new ApiError(400, 'El orden debe ser un entero no negativo.');
  }
  return value;
}

function normalizeNullableId(value, field) {
  if (value === undefined || value === null || value === '') return null;
  if (!isValidId(value)) {
    throw new ApiError(400, `${field} inválido.`);
  }
  return value;
}

function serializeSourceDecks(sourceDecks) {
  return Array.isArray(sourceDecks)
    ? sourceDecks.map((sourceDeck) => ({
        deckId: sourceDeck.deckId,
        questionCount: sourceDeck.questionCount,
      }))
    : [];
}

function shuffle(items) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function normalizeAnswerForComparison(value) {
  return typeof value === 'string'
    ? value.trim().replace(/\s+/g, ' ').toLocaleLowerCase()
    : '';
}

function normalizeFolderPath(value) {
  if (value === null) return null;
  if (!isPlainObject(value)) {
    throw new ApiError(400, 'folderPath debe ser un objeto o null.');
  }

  const folderPath = {};
  for (const field of ['materiaId', 'temaId', 'subtemaId']) {
    folderPath[field] = normalizeNullableId(value[field], field);
  }
  return folderPath;
}

async function resolveFolderId(userId, value) {
  const folderId = normalizeNullableId(value, 'Carpeta de exámenes');
  if (!folderId) return null;

  const folder = await ExamFolder.findOne({ _id: folderId, userId }).select('_id');
  if (!folder) {
    throw new ApiError(404, 'La carpeta de exámenes no existe.');
  }
  return folder._id;
}

async function validateSourceDecks(userId, sourceType, rawSourceDecks) {
  if (sourceType === 'scratch') {
    if (rawSourceDecks !== undefined && (!Array.isArray(rawSourceDecks) || rawSourceDecks.length > 0)) {
      throw new ApiError(400, 'Los exámenes desde cero no pueden tener mazos de origen.');
    }
    return [];
  }

  if (!Array.isArray(rawSourceDecks) || rawSourceDecks.length === 0) {
    throw new ApiError(400, 'Selecciona al menos un mazo de origen.');
  }

  const sourceDecks = [];
  const seenDeckIds = new Set();
  let total = 0;

  for (const sourceDeck of rawSourceDecks) {
    if (!isPlainObject(sourceDeck) || !isValidId(sourceDeck.deckId)) {
      throw new ApiError(400, 'Uno de los mazos de origen es inválido.');
    }

    const questionCount = Number(sourceDeck.questionCount);
    if (!Number.isInteger(questionCount) || questionCount < 1) {
      throw new ApiError(400, 'Cada mazo de origen debe aportar al menos una pregunta.');
    }

    const deckId = String(sourceDeck.deckId);
    if (seenDeckIds.has(deckId)) {
      throw new ApiError(400, 'Un mazo de origen solo puede aparecer una vez.');
    }
    seenDeckIds.add(deckId);

    total += questionCount;
    if (total > MAX_QUESTIONS) {
      throw new ApiError(400, `La suma de preguntas de los mazos no puede superar ${MAX_QUESTIONS}.`);
    }

    const deck = await Deck.findOne({ _id: sourceDeck.deckId, userId }).select('_id');
    if (!deck) {
      throw new ApiError(404, 'Uno de los mazos de origen no existe o no te pertenece.');
    }

    const cardCount = await Flashcard.countDocuments({ deckId: deck._id });
    if (questionCount > cardCount) {
      throw new ApiError(400, 'Un mazo de origen no tiene suficientes tarjetas para la selección solicitada.');
    }

    sourceDecks.push({ deckId: deck._id, questionCount });
  }

  return sourceDecks;
}

async function getOwnedExam(examId, userId) {
  if (!isValidId(examId)) {
    throw new ApiError(400, 'Examen inválido.');
  }

  const exam = await Exam.findOne({ _id: examId, userId });
  if (!exam) {
    throw new ApiError(404, 'Examen no encontrado.');
  }
  return exam;
}

async function getNextOrder(examId) {
  const lastQuestion = await Question.findOne({ examId }).sort({ order: -1 }).select('order').lean();
  return lastQuestion ? lastQuestion.order + 1 : 0;
}

async function synchronizeQuestionCount(exam) {
  const questionCount = await Question.countDocuments({ examId: exam._id });
  if (exam.questionCount !== questionCount) {
    exam.questionCount = questionCount;
    await exam.save();
  }
  return questionCount;
}

async function ensureQuestionCapacity(examId, additionalCount) {
  const currentCount = await Question.countDocuments({ examId });
  if (currentCount + additionalCount > MAX_QUESTIONS) {
    throw new ApiError(400, `Un examen no puede tener más de ${MAX_QUESTIONS} preguntas.`);
  }
  return currentCount;
}

function normalizeOptions(rawOptions) {
  if (!Array.isArray(rawOptions) || rawOptions.length < 2) {
    throw new ApiError(400, 'Las preguntas de opción múltiple requieren al menos dos opciones.');
  }

  const optionIds = new Set();
  return rawOptions.map((option, index) => {
    if (!isPlainObject(option)) {
      throw new ApiError(400, `La opción ${index + 1} es inválida.`);
    }
    const id = requireText(option.id, `El identificador de la opción ${index + 1}`, 200);
    const text = requireText(option.text, `El texto de la opción ${index + 1}`);
    if (optionIds.has(id)) {
      throw new ApiError(400, 'Los identificadores de opción deben ser únicos.');
    }
    optionIds.add(id);
    return { id, text };
  });
}

function normalizeQuestionInput(input, defaultOrder) {
  if (!isPlainObject(input)) {
    throw new ApiError(400, 'La pregunta es inválida.');
  }

  const type = normalizeQuestionType(input.type);
  const promptValue = input.prompt !== undefined ? input.prompt : input.question;
  const prompt = requireText(promptValue, 'El enunciado');
  const sourceCardId = normalizeNullableId(input.sourceCardId, 'Tarjeta de origen');
  const order = normalizeOrder(input.order, defaultOrder);

  if (type === 'multiple_choice') {
    const options = normalizeOptions(input.options);
    const correctOptionId = requireText(input.correctOptionId, 'La opción correcta', 200);
    if (!options.some((option) => option.id === correctOptionId)) {
      throw new ApiError(400, 'La opción correcta debe existir entre las opciones.');
    }
    return {
      type,
      prompt,
      options,
      correctOptionId,
      correctBoolean: null,
      expectedAnswer: null,
      sourceCardId,
      order,
    };
  }

  if (type === 'true_false') {
    const correctBoolean = input.correctBoolean !== undefined
      ? input.correctBoolean
      : (input.correctAnswer !== undefined ? input.correctAnswer : input.isTrue);
    if (typeof correctBoolean !== 'boolean') {
      throw new ApiError(400, 'Las preguntas verdadero/falso requieren correctBoolean booleano.');
    }
    return {
      type,
      prompt,
      options: [],
      correctOptionId: null,
      correctBoolean,
      expectedAnswer: null,
      sourceCardId,
      order,
    };
  }

  return {
    type,
    prompt,
    options: [],
    correctOptionId: null,
    correctBoolean: null,
    expectedAnswer: requireText(input.expectedAnswer, 'La respuesta esperada', MAX_OPEN_ANSWER_LENGTH),
    sourceCardId,
    order,
  };
}

function questionToInput(question) {
  return {
    type: question.type,
    prompt: question.prompt,
    options: Array.isArray(question.options)
      ? question.options.map((option) => ({ id: option.id, text: option.text }))
      : [],
    correctOptionId: question.correctOptionId,
    correctBoolean: question.correctBoolean,
    expectedAnswer: question.expectedAnswer,
    sourceCardId: question.sourceCardId,
    order: question.order,
  };
}

function mergeQuestionInput(question, updates) {
  const current = questionToInput(question);
  return {
    type: hasOwn(updates, 'type') ? updates.type : current.type,
    prompt: hasOwn(updates, 'prompt')
      ? updates.prompt
      : (hasOwn(updates, 'question') ? updates.question : current.prompt),
    options: hasOwn(updates, 'options') ? updates.options : current.options,
    correctOptionId: hasOwn(updates, 'correctOptionId')
      ? updates.correctOptionId
      : current.correctOptionId,
    correctBoolean: hasOwn(updates, 'correctBoolean')
      ? updates.correctBoolean
      : (hasOwn(updates, 'correctAnswer')
        ? updates.correctAnswer
        : (hasOwn(updates, 'isTrue') ? updates.isTrue : current.correctBoolean)),
    expectedAnswer: hasOwn(updates, 'expectedAnswer')
      ? updates.expectedAnswer
      : current.expectedAnswer,
    sourceCardId: hasOwn(updates, 'sourceCardId')
      ? updates.sourceCardId
      : current.sourceCardId,
    order: hasOwn(updates, 'order') ? updates.order : current.order,
  };
}

async function validateSourceCardReferences(userId, questions) {
  const sourceCardIds = [...new Set(
    questions
      .map((question) => question.sourceCardId)
      .filter(Boolean)
      .map((sourceCardId) => String(sourceCardId))
  )];

  if (sourceCardIds.length === 0) return;

  const ownedCards = await Flashcard.find({
    _id: { $in: sourceCardIds },
    userId,
  }).select('_id').lean();

  if (ownedCards.length !== sourceCardIds.length) {
    throw new ApiError(404, 'Una tarjeta de origen no existe o no te pertenece.');
  }
}

async function saveQuestionDocuments(questionDocuments) {
  const validatedDocuments = [];
  for (const document of questionDocuments) {
    const question = new Question(document);
    await question.validate();
    validatedDocuments.push(question);
  }
  return Question.insertMany(validatedDocuments);
}

function getCardId(card) {
  const candidate = card?.sourceCardId ?? card?._id ?? card?.id;
  return isValidId(candidate) ? candidate : null;
}

function getCardText(card, field) {
  return requireText(card?.[field], field === 'question' ? 'La pregunta de la tarjeta' : 'La respuesta de la tarjeta');
}

function uniqueAlternativeAnswers(deckCards, correctAnswer) {
  const usedAnswers = new Set([normalizeAnswerForComparison(correctAnswer)]);
  const alternatives = [];

  for (const deckCard of deckCards) {
    const answer = typeof deckCard?.answer === 'string' ? deckCard.answer.trim() : '';
    const normalizedAnswer = normalizeAnswerForComparison(answer);
    if (!answer || !normalizedAnswer || usedAnswers.has(normalizedAnswer)) continue;
    usedAnswers.add(normalizedAnswer);
    alternatives.push(answer);
  }

  return alternatives;
}

function generateFromDeckData(card, deckCards, type) {
  const questionType = normalizeQuestionType(type);
  const prompt = getCardText(card, 'question');
  const answer = getCardText(card, 'answer');
  const sourceCardId = getCardId(card);
  const alternatives = uniqueAlternativeAnswers(deckCards, answer);

  if (questionType === 'multiple_choice') {
    if (alternatives.length === 0) {
      throw new ApiError(422, 'No hay respuestas alternativas suficientes para crear una pregunta de opción múltiple.');
    }

    const optionTexts = shuffle([answer, ...shuffle(alternatives).slice(0, 3)]);
    const options = optionTexts.map((text, index) => ({
      id: `option-${index + 1}`,
      text,
    }));
    const correctOption = options.find((option) => option.text === answer);

    return {
      type: questionType,
      prompt,
      options,
      correctOptionId: correctOption.id,
      correctBoolean: null,
      expectedAnswer: null,
      sourceCardId,
    };
  }

  if (questionType === 'true_false') {
    const useFalseStatement = alternatives.length > 0 && Math.random() < 0.5;
    const proposedAnswer = useFalseStatement
      ? alternatives[Math.floor(Math.random() * alternatives.length)]
      : answer;

    return {
      type: questionType,
      prompt: `${prompt}\n\nRespuesta propuesta: ${proposedAnswer}`,
      options: [],
      correctOptionId: null,
      correctBoolean: !useFalseStatement,
      expectedAnswer: null,
      sourceCardId,
    };
  }

  return {
    type: questionType,
    prompt,
    options: [],
    correctOptionId: null,
    correctBoolean: null,
    expectedAnswer: answer,
    sourceCardId,
  };
}

async function loadSelectedSourceCards(exam, userId) {
  if (exam.sourceType !== 'from_deck' || !Array.isArray(exam.sourceDecks) || exam.sourceDecks.length === 0) {
    throw new ApiError(400, 'El examen no tiene mazos de origen configurados.');
  }

  const groups = [];
  for (const sourceDeck of exam.sourceDecks) {
    const deck = await Deck.findOne({ _id: sourceDeck.deckId, userId }).select('_id');
    if (!deck) {
      throw new ApiError(409, 'Uno de los mazos de origen ya no existe o dejó de pertenecerte.');
    }

    const deckCards = await Flashcard.find({ deckId: deck._id })
      .select('_id question answer')
      .lean();
    if (deckCards.length < sourceDeck.questionCount) {
      throw new ApiError(409, 'Uno de los mazos de origen ya no tiene suficientes tarjetas.');
    }

    const validCards = deckCards.filter((deckCard) => (
      typeof deckCard.question === 'string'
      && deckCard.question.trim()
      && typeof deckCard.answer === 'string'
      && deckCard.answer.trim()
    ));
    if (validCards.length < sourceDeck.questionCount) {
      throw new ApiError(422, 'Uno de los mazos de origen tiene tarjetas incompletas.');
    }

    groups.push({
      deckCards: validCards,
      selectedCards: shuffle(validCards).slice(0, sourceDeck.questionCount),
    });
  }

  return groups;
}

function buildDeckGeneratedQuestions(groups, type, startOrder) {
  const questions = [];
  const warnings = [];

  for (const group of groups) {
    for (const card of group.selectedCards) {
      const question = generateFromDeckData(card, group.deckCards, type);
      question.order = startOrder + questions.length;
      questions.push(question);

      if (question.type === 'multiple_choice' && question.options.length < 4) {
        const warning = 'Una pregunta de opción múltiple se generó con menos de cuatro opciones por falta de distractores únicos.';
        warnings.push({ sourceCardId: question.sourceCardId ?? null, message: warning });
        console.warn('[exams:generate-from-decks] %s', warning);
      }
    }
  }

  return { questions, warnings };
}

function normalizeAiCards(rawCards) {
  if (!Array.isArray(rawCards) || rawCards.length === 0) {
    throw new ApiError(400, 'Proporciona al menos una tarjeta para generar preguntas con IA.');
  }
  if (rawCards.length > MAX_QUESTIONS) {
    throw new ApiError(400, `No se pueden procesar más de ${MAX_QUESTIONS} tarjetas a la vez.`);
  }

  return rawCards.map((card) => {
    if (!isPlainObject(card)) {
      throw new ApiError(400, 'Una tarjeta para IA es inválida.');
    }
    return {
      sourceCardId: getCardId(card),
      question: getCardText(card, 'question'),
      answer: getCardText(card, 'answer'),
    };
  });
}

async function validateAiSourceCards(userId, cards) {
  const questions = cards.map((card) => ({ sourceCardId: card.sourceCardId }));
  await validateSourceCardReferences(userId, questions);
}

async function generateQuestionsWithAi(cards, type, apiKey) {
  const requestBody = {
    model: 'deepseek-chat',
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `Eres un generador de preguntas de examen en español. Devuelve SOLO JSON válido con esta forma exacta: {"questions":[...]}. Genera exactamente una pregunta por tarjeta de entrada y conserva su sourceIndex (entero de base cero). El tipo pedido es "${type}".

Para "multiple_choice", cada objeto debe contener sourceIndex, prompt, options (arreglo de {id,text}) y correctOptionId. Incluye la respuesta correcta y distractores plausibles, distintos y académicamente razonables. Debe haber entre 2 y 4 opciones.
Para "true_false", cada objeto debe contener sourceIndex, prompt y correctBoolean booleano. El prompt debe ser una afirmación clara; aproximadamente la mitad de las afirmaciones deben ser falsas, sin inventar hechos fuera de las tarjetas.
Para "open", cada objeto debe contener sourceIndex, prompt y expectedAnswer. Evalúa el mismo conocimiento de la tarjeta con una respuesta breve y verificable.

No incluyas markdown, explicaciones ni claves adicionales.`,
      },
      {
        role: 'user',
        content: JSON.stringify({ type, cards }),
      },
    ],
  };

  requestBody.temperature = 0.2;

  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    throw new ApiError(502, 'El motor de IA no pudo generar las preguntas.');
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new ApiError(502, 'El motor de IA devolvió una respuesta vacía.');
  }

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new ApiError(502, 'El motor de IA devolvió un formato inválido.');
  }

  if (!isPlainObject(parsed) || !Array.isArray(parsed.questions) || parsed.questions.length !== cards.length) {
    throw new ApiError(502, 'El motor de IA devolvió una cantidad inválida de preguntas.');
  }

  return parsed.questions;
}

async function auditQuestionsWithAi(cards, rawQuestions, type, apiKey) {
  const useReasoner = rawQuestions.length > AI_REASONER_THRESHOLD;
  const requestBody = {
    model: useReasoner ? 'deepseek-reasoner' : 'deepseek-chat',
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `Eres un auditor académico de preguntas de examen en español. Revisa cada pregunta preliminar contra su tarjeta fuente. Devuelve SOLO JSON válido con esta forma exacta: {"questions":[...]}. Conserva exactamente una pregunta por tarjeta, su sourceIndex original y el tipo "${type}".

Corrige distractores obvios, duplicados, ambiguos o factualmente incompatibles con la respuesta de la tarjeta. Para opción múltiple, conserva entre 2 y 4 opciones distintas y una correctOptionId existente. Para verdadero/falso, conserva correctBoolean booleano y evita afirmaciones ambiguas. Para abiertas, conserva una expectedAnswer breve, verificable y coherente con la fuente.

No elimines preguntas, no agregues explicaciones, no incluyas markdown ni claves adicionales.`,
      },
      {
        role: 'user',
        content: JSON.stringify({ type, cards, questions: rawQuestions }),
      },
    ],
  };

  if (!useReasoner) requestBody.temperature = 0.1;

  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    throw new ApiError(502, 'El auditor de IA no pudo validar las preguntas.');
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new ApiError(502, 'El auditor de IA devolvió una respuesta vacía.');
  }

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new ApiError(502, 'El auditor de IA devolvió un formato inválido.');
  }

  if (!isPlainObject(parsed) || !Array.isArray(parsed.questions) || parsed.questions.length !== cards.length) {
    throw new ApiError(502, 'El auditor de IA devolvió una cantidad inválida de preguntas.');
  }

  return parsed.questions;
}

function aiCandidateToQuestionInput(candidate, card, type, order) {
  if (!isPlainObject(candidate)) {
    throw new ApiError(502, 'El motor de IA devolvió una pregunta inválida.');
  }

  const prompt = candidate.prompt !== undefined ? candidate.prompt : candidate.question;
  const base = {
    type,
    prompt,
    sourceCardId: card.sourceCardId,
    order,
  };

  if (type === 'multiple_choice') {
    if (!Array.isArray(candidate.options)) {
      throw new ApiError(502, 'El motor de IA no devolvió opciones válidas.');
    }

    const options = candidate.options.map((option, index) => ({
      id: typeof option?.id === 'string' && option.id.trim() ? option.id.trim() : `option-${index + 1}`,
      text: typeof option === 'string' ? option : option?.text,
    }));
    let correctOptionId = candidate.correctOptionId;
    if (typeof correctOptionId !== 'string' || !options.some((option) => option.id === correctOptionId)) {
      const correctOptionIndex = candidate.correctOptionIndex;
      if (Number.isInteger(correctOptionIndex) && options[correctOptionIndex]) {
        correctOptionId = options[correctOptionIndex].id;
      } else if (typeof candidate.correctAnswer === 'string') {
        const matchingOption = options.find((option) => (
          normalizeAnswerForComparison(option.text) === normalizeAnswerForComparison(candidate.correctAnswer)
        ));
        correctOptionId = matchingOption?.id;
      }
    }

    return normalizeQuestionInput({ ...base, options, correctOptionId }, order);
  }

  if (type === 'true_false') {
    return normalizeQuestionInput({
      ...base,
      correctBoolean: candidate.correctBoolean ?? candidate.correctAnswer,
    }, order);
  }

  return normalizeQuestionInput({
    ...base,
    expectedAnswer: candidate.expectedAnswer ?? card.answer,
  }, order);
}

function normalizeBooleanAnswer(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    if (value.trim().toLowerCase() === 'true') return true;
    if (value.trim().toLowerCase() === 'false') return false;
  }
  return null;
}

function getAttemptAnswerValue(answer) {
  if (hasOwn(answer, 'answer')) return answer.answer;
  if (hasOwn(answer, 'response')) return answer.response;
  if (hasOwn(answer, 'selectedOptionId')) return answer.selectedOptionId;
  return null;
}

function normalizeAttemptAnswer(question, value, manualCorrect) {
  if (question.type === 'multiple_choice') {
    const answer = typeof value === 'string' ? value.trim().slice(0, 200) : null;
    return {
      answer,
      isCorrect: answer !== null && answer === question.correctOptionId,
    };
  }

  if (question.type === 'true_false') {
    const answer = normalizeBooleanAnswer(value);
    return {
      answer,
      isCorrect: answer !== null && answer === question.correctBoolean,
    };
  }

  const answer = typeof value === 'string' ? value.trim().slice(0, MAX_OPEN_ANSWER_LENGTH) : null;
  if (manualCorrect !== undefined && typeof manualCorrect !== 'boolean') {
    throw new ApiError(400, 'La autocalificación de una respuesta abierta debe ser booleana.');
  }
  if (manualCorrect !== undefined && !answer) {
    throw new ApiError(400, 'Escribe una respuesta antes de autocalificar una pregunta abierta.');
  }

  return {
    answer,
    isCorrect: manualCorrect !== undefined
      ? manualCorrect
      : (answer !== null
        && normalizeAnswerForComparison(answer) === normalizeAnswerForComparison(question.expectedAnswer)),
  };
}

function calculatePerTypeBreakdown(questions, answersByQuestionId) {
  const perTypeBreakdown = {};
  let score = 0;

  for (const question of questions) {
    if (!perTypeBreakdown[question.type]) {
      perTypeBreakdown[question.type] = { correct: 0, total: 0 };
    }
    perTypeBreakdown[question.type].total += 1;

    const answer = answersByQuestionId.get(String(question._id));
    if (answer?.isCorrect) {
      score += 1;
      perTypeBreakdown[question.type].correct += 1;
    }
  }

  return { score, perTypeBreakdown };
}

function normalizeAttemptMode(value) {
  if (value === undefined || value === null) return 'practice';
  const mode = requireText(value, 'El modo', 50);
  return mode;
}

function normalizeDurationSeconds(body) {
  const value = body.durationSeconds !== undefined
    ? body.durationSeconds
    : (body.elapsedSeconds !== undefined ? body.elapsedSeconds : body.elapsedTime);
  if (value === undefined || value === null || value === '') return null;

  const durationSeconds = Number(value);
  if (!Number.isFinite(durationSeconds) || durationSeconds < 0) {
    throw new ApiError(400, 'durationSeconds debe ser un número no negativo.');
  }
  return durationSeconds;
}

function sendError(scope, res, err) {
  if (err instanceof ApiError) {
    return res.status(err.status).json({ error: err.message });
  }
  if (err?.name === 'ValidationError') {
    const firstError = Object.values(err.errors || {})[0];
    return res.status(400).json({ error: firstError?.message || 'Los datos son inválidos.' });
  }
  if (err?.name === 'CastError') {
    return res.status(400).json({ error: 'Uno de los identificadores es inválido.' });
  }

  console.error(`[${scope}] error:`, err.message);
  return res.status(500).json({ error: 'No se pudo completar la operación de exámenes.' });
}

exports.listExams = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!isValidId(userId)) {
      throw new ApiError(400, 'Usuario inválido.');
    }
    if (req.query.userId !== undefined && !sameId(req.query.userId, userId)) {
      throw new ApiError(400, 'El usuario de la consulta no coincide con la ruta.');
    }

    const query = { userId };
    if (req.query.folderId !== undefined) {
      if (req.query.folderId === '' || req.query.folderId === 'null') {
        query.folderId = null;
      } else {
        query.folderId = await resolveFolderId(userId, req.query.folderId);
      }
    }

    const exams = await Exam.find(query).sort({ createdAt: -1 });
    return res.json(exams.map((exam) => exam.serialize()));
  } catch (err) {
    return sendError('exams:list', res, err);
  }
};

exports.getExam = async (req, res) => {
  try {
    const userId = requireUserId(req);
    const exam = await getOwnedExam(req.params.id, userId);
    return res.json(exam.serialize());
  } catch (err) {
    return sendError('exams:get', res, err);
  }
};

exports.createExam = async (req, res) => {
  let createdExam = null;

  try {
    const body = req.body || {};
    const userId = requireUserId(req);
    const title = requireText(body.title, 'El título');
    const sourceType = body.sourceType === undefined ? 'scratch' : normalizeSourceType(body.sourceType);
    const sourceDecks = await validateSourceDecks(
      userId,
      sourceType,
      body.sourceDecks === undefined ? [] : body.sourceDecks
    );
    const folderId = await resolveFolderId(userId, body.folderId);
    const folderPath = body.folderPath === undefined ? null : normalizeFolderPath(body.folderPath);

    if (body.questions !== undefined && !Array.isArray(body.questions)) {
      throw new ApiError(400, 'questions debe ser un arreglo.');
    }
    const manualQuestions = (body.questions || []).map((question, index) => (
      normalizeQuestionInput(question, index)
    ));
    if (manualQuestions.length > MAX_QUESTIONS) {
      throw new ApiError(400, `Un examen no puede tener más de ${MAX_QUESTIONS} preguntas.`);
    }

    const autoGenerate = body.autoGenerate === true
      || body.autogenerate === true
      || body.generateFromDecks === true;
    let autoGeneratedQuestions = [];
    let warnings = [];
    if (autoGenerate) {
      if (sourceType !== 'from_deck') {
        throw new ApiError(400, 'La generación automática requiere mazos de origen.');
      }
      const type = normalizeQuestionType(body.type ?? body.questionType ?? 'multiple_choice');
      const groups = await loadSelectedSourceCards({ sourceType, sourceDecks }, userId);
      const startOrder = manualQuestions.reduce(
        (highestOrder, question) => Math.max(highestOrder, question.order),
        -1
      ) + 1;
      const generated = buildDeckGeneratedQuestions(groups, type, startOrder);
      autoGeneratedQuestions = generated.questions;
      warnings = generated.warnings;
    }

    const allQuestions = [...manualQuestions, ...autoGeneratedQuestions];
    if (allQuestions.length > MAX_QUESTIONS) {
      throw new ApiError(400, `Un examen no puede tener más de ${MAX_QUESTIONS} preguntas.`);
    }
    await validateSourceCardReferences(userId, allQuestions);

    createdExam = await Exam.create({
      userId,
      title,
      folderId,
      folderPath,
      sourceType,
      sourceDecks,
      questionCount: 0,
    });

    if (allQuestions.length > 0) {
      await saveQuestionDocuments(allQuestions.map((question) => ({
        ...question,
        examId: createdExam._id,
      })));
      await synchronizeQuestionCount(createdExam);
    }

    const payload = createdExam.serialize();
    if (warnings.length > 0) payload.warnings = warnings;
    return res.status(201).json(payload);
  } catch (err) {
    if (createdExam) {
      try {
        await Question.deleteMany({ examId: createdExam._id });
        await createdExam.deleteOne();
      } catch (cleanupError) {
        console.error('[exams:create] cleanup error:', cleanupError.message);
      }
    }
    return sendError('exams:create', res, err);
  }
};

exports.updateExam = async (req, res) => {
  try {
    const body = req.body || {};
    const userId = requireUserId(req);
    const exam = await getOwnedExam(req.params.id, userId);

    if (hasOwn(body, 'title')) {
      exam.title = requireText(body.title, 'El título');
    }
    if (hasOwn(body, 'folderId')) {
      exam.folderId = await resolveFolderId(userId, body.folderId);
    }
    if (hasOwn(body, 'folderPath')) {
      exam.folderPath = normalizeFolderPath(body.folderPath);
    }
    if (hasOwn(body, 'isStarred')) {
      if (typeof body.isStarred !== 'boolean') {
        throw new ApiError(400, 'isStarred debe ser booleano.');
      }
      exam.isStarred = body.isStarred;
    }

    if (hasOwn(body, 'sourceType') || hasOwn(body, 'sourceDecks')) {
      const sourceType = hasOwn(body, 'sourceType')
        ? normalizeSourceType(body.sourceType)
        : exam.sourceType;
      let sourceDecks = hasOwn(body, 'sourceDecks')
        ? body.sourceDecks
        : serializeSourceDecks(exam.sourceDecks);

      if (sourceType === 'scratch' && hasOwn(body, 'sourceType') && !hasOwn(body, 'sourceDecks')) {
        sourceDecks = [];
      }

      const validatedSourceDecks = await validateSourceDecks(userId, sourceType, sourceDecks);
      exam.sourceType = sourceType;
      exam.sourceDecks = validatedSourceDecks;
    }

    await exam.save();
    return res.json(exam.serialize());
  } catch (err) {
    return sendError('exams:update', res, err);
  }
};

exports.deleteExam = async (req, res) => {
  try {
    const userId = requireUserId(req);
    const exam = await getOwnedExam(req.params.id, userId);

    await Promise.all([
      Question.deleteMany({ examId: exam._id }),
      ExamAttempt.deleteMany({ examId: exam._id }),
    ]);
    await exam.deleteOne();
    return res.json({ success: true, id: exam._id });
  } catch (err) {
    return sendError('exams:delete', res, err);
  }
};

exports.listQuestions = async (req, res) => {
  try {
    const userId = requireUserId(req);
    const exam = await getOwnedExam(req.params.id, userId);
    const questions = await Question.find({ examId: exam._id }).sort({ order: 1, createdAt: 1 });
    return res.json(questions.map((question) => question.serialize()));
  } catch (err) {
    return sendError('examQuestions:list', res, err);
  }
};

exports.createQuestion = async (req, res) => {
  try {
    const body = req.body || {};
    const userId = requireUserId(req);
    const exam = await getOwnedExam(req.params.id, userId);
    await ensureQuestionCapacity(exam._id, 1);

    const rawQuestion = isPlainObject(body.question) ? body.question : body;
    const order = await getNextOrder(exam._id);
    const questionData = normalizeQuestionInput(rawQuestion, order);
    await validateSourceCardReferences(userId, [questionData]);

    const [question] = await saveQuestionDocuments([{ ...questionData, examId: exam._id }]);
    await synchronizeQuestionCount(exam);
    return res.status(201).json(question.serialize());
  } catch (err) {
    return sendError('examQuestions:create', res, err);
  }
};

exports.createQuestionsBulk = async (req, res) => {
  try {
    const body = req.body || {};
    const userId = requireUserId(req);
    const exam = await getOwnedExam(req.params.id, userId);
    if (!Array.isArray(body.questions) || body.questions.length === 0) {
      throw new ApiError(400, 'Proporciona al menos una pregunta.');
    }
    if (body.questions.length > MAX_QUESTIONS) {
      throw new ApiError(400, `No se pueden crear más de ${MAX_QUESTIONS} preguntas por lote.`);
    }

    await ensureQuestionCapacity(exam._id, body.questions.length);
    const nextOrder = await getNextOrder(exam._id);
    const questionData = body.questions.map((question, index) => (
      normalizeQuestionInput(question, nextOrder + index)
    ));
    await validateSourceCardReferences(userId, questionData);

    const questions = await saveQuestionDocuments(questionData.map((question) => ({
      ...question,
      examId: exam._id,
    })));
    await synchronizeQuestionCount(exam);
    return res.status(201).json(questions.map((question) => question.serialize()));
  } catch (err) {
    return sendError('examQuestions:bulk', res, err);
  }
};

exports.updateQuestion = async (req, res) => {
  try {
    const userId = requireUserId(req);
    const exam = await getOwnedExam(req.params.id, userId);
    if (!isValidId(req.params.questionId)) {
      throw new ApiError(400, 'Pregunta inválida.');
    }

    const question = await Question.findOne({ _id: req.params.questionId, examId: exam._id });
    if (!question) {
      throw new ApiError(404, 'Pregunta no encontrada.');
    }

    const questionData = normalizeQuestionInput(mergeQuestionInput(question, req.body || {}), question.order);
    await validateSourceCardReferences(userId, [questionData]);
    Object.assign(question, questionData);
    await question.save();
    return res.json(question.serialize());
  } catch (err) {
    return sendError('examQuestions:update', res, err);
  }
};

exports.deleteQuestion = async (req, res) => {
  try {
    const userId = requireUserId(req);
    const exam = await getOwnedExam(req.params.id, userId);
    if (!isValidId(req.params.questionId)) {
      throw new ApiError(400, 'Pregunta inválida.');
    }

    const question = await Question.findOneAndDelete({ _id: req.params.questionId, examId: exam._id });
    if (!question) {
      throw new ApiError(404, 'Pregunta no encontrada.');
    }
    await synchronizeQuestionCount(exam);
    return res.json({ success: true, id: question._id });
  } catch (err) {
    return sendError('examQuestions:delete', res, err);
  }
};

exports.generateFromDecks = async (req, res) => {
  try {
    const body = req.body || {};
    const userId = requireUserId(req);
    const exam = await getOwnedExam(req.params.id, userId);
    const type = normalizeQuestionType(body.type ?? body.questionType ?? 'multiple_choice');
    const groups = await loadSelectedSourceCards(exam, userId);
    const generatedCount = groups.reduce((total, group) => total + group.selectedCards.length, 0);
    await ensureQuestionCapacity(exam._id, generatedCount);

    const nextOrder = await getNextOrder(exam._id);
    const generated = buildDeckGeneratedQuestions(groups, type, nextOrder);
    const questions = await saveQuestionDocuments(generated.questions.map((question) => ({
      ...question,
      examId: exam._id,
    })));
    const questionCount = await synchronizeQuestionCount(exam);

    return res.status(201).json({
      questions: questions.map((question) => question.serialize()),
      warnings: generated.warnings,
      questionCount,
    });
  } catch (err) {
    return sendError('exams:generate-from-decks', res, err);
  }
};

exports.generateQuestionsAi = async (req, res) => {
  try {
    const body = req.body || {};
    const userId = requireUserId(req);
    if (!isValidId(body.examId)) {
      throw new ApiError(400, 'Examen inválido.');
    }
    const exam = await getOwnedExam(body.examId, userId);
    const type = normalizeQuestionType(body.type ?? body.questionType ?? 'multiple_choice');

    let cards;
    if (body.cards !== undefined) {
      cards = normalizeAiCards(body.cards);
      await validateAiSourceCards(userId, cards);
    } else {
      const groups = await loadSelectedSourceCards(exam, userId);
      cards = groups.flatMap((group) => group.selectedCards.map((card) => ({
        sourceCardId: card._id,
        question: card.question,
        answer: card.answer,
      })));
    }

    await ensureQuestionCapacity(exam._id, cards.length);
    const user = await User.findById(userId).select('aiApiKey');
    if (!user || !user.aiApiKey) {
      throw new ApiError(400, 'No has configurado tu API Key en la sección de Ajustes.');
    }

    const rawCandidates = await generateQuestionsWithAi(cards, type, user.aiApiKey);
    const candidates = await auditQuestionsWithAi(cards, rawCandidates, type, user.aiApiKey);
    const usedSourceIndexes = new Set();
    const nextOrder = await getNextOrder(exam._id);
    const questionData = candidates.map((candidate, index) => {
      const sourceIndex = candidate?.sourceIndex === undefined ? index : candidate.sourceIndex;
      if (!Number.isInteger(sourceIndex) || !cards[sourceIndex] || usedSourceIndexes.has(sourceIndex)) {
        throw new ApiError(502, 'El motor de IA devolvió referencias de tarjetas inválidas.');
      }
      usedSourceIndexes.add(sourceIndex);
      return aiCandidateToQuestionInput(candidate, cards[sourceIndex], type, nextOrder + index);
    });

    const questions = await saveQuestionDocuments(questionData.map((question) => ({
      ...question,
      examId: exam._id,
    })));
    const questionCount = await synchronizeQuestionCount(exam);
    return res.status(201).json({
      questions: questions.map((question) => question.serialize()),
      questionCount,
    });
  } catch (err) {
    return sendError('exams:generate-ai', res, err);
  }
};

exports.createAttempt = async (req, res) => {
  try {
    const body = req.body || {};
    const userId = requireUserId(req);
    const exam = await getOwnedExam(req.params.id, userId);
    if (body.answers !== undefined && !Array.isArray(body.answers)) {
      throw new ApiError(400, 'answers debe ser un arreglo.');
    }

    const rawAnswers = body.answers || [];
    if (rawAnswers.length > MAX_QUESTIONS) {
      throw new ApiError(400, `No se pueden registrar más de ${MAX_QUESTIONS} respuestas.`);
    }

    const mode = normalizeAttemptMode(body.mode);
    const durationSeconds = normalizeDurationSeconds(body);
    const hasSummary = body.score !== undefined || body.total !== undefined || body.perTypeBreakdown !== undefined;
    let attemptData;

    if (body.questionIds !== undefined || rawAnswers.length > 0 || !hasSummary) {
      const answerIds = new Set();
      for (const answer of rawAnswers) {
        if (!isPlainObject(answer) || !isValidId(answer.questionId)) {
          throw new ApiError(400, 'Una respuesta no tiene una pregunta válida.');
        }
        const questionId = String(answer.questionId);
        if (answerIds.has(questionId)) {
          throw new ApiError(400, 'Una pregunta no puede responderse más de una vez por intento.');
        }
        answerIds.add(questionId);
      }

      let requestedQuestionIds = null;
      if (body.questionIds !== undefined) {
        if (!Array.isArray(body.questionIds) || body.questionIds.length === 0 || body.questionIds.length > MAX_QUESTIONS) {
          throw new ApiError(400, 'questionIds debe contener entre una y 100 preguntas.');
        }
        requestedQuestionIds = [...new Set(body.questionIds.map((questionId) => String(questionId)))];
        if (requestedQuestionIds.length !== body.questionIds.length || requestedQuestionIds.some((questionId) => !isValidId(questionId))) {
          throw new ApiError(400, 'questionIds contiene una pregunta inválida o repetida.');
        }
      }

      const allQuestions = await Question.find({
        examId: exam._id,
        ...(requestedQuestionIds ? { _id: { $in: requestedQuestionIds } } : {}),
      });
      if (requestedQuestionIds && allQuestions.length !== requestedQuestionIds.length) {
        throw new ApiError(400, 'Una pregunta seleccionada no pertenece a este examen.');
      }
      const answeredQuestions = rawAnswers.length > 0
        ? allQuestions.filter((question) => answerIds.has(String(question._id)))
        : [];
      if (answeredQuestions.length !== answerIds.size) {
        throw new ApiError(400, 'Una respuesta no pertenece a este examen.');
      }

      const questionsById = new Map(answeredQuestions.map((question) => [String(question._id), question]));
      const answersByQuestionId = new Map();
      const answers = rawAnswers.map((rawAnswer) => {
        const question = questionsById.get(String(rawAnswer.questionId));
        const normalizedAnswer = normalizeAttemptAnswer(
          question,
          getAttemptAnswerValue(rawAnswer),
          question.type === 'open' && hasOwn(rawAnswer, 'manualCorrect')
            ? rawAnswer.manualCorrect
            : undefined
        );
        const answer = {
          questionId: question._id,
          answer: normalizedAnswer.answer,
          isCorrect: normalizedAnswer.isCorrect,
        };
        answersByQuestionId.set(String(question._id), answer);
        return answer;
      });
      const calculated = calculatePerTypeBreakdown(allQuestions, answersByQuestionId);

      attemptData = {
        userId,
        examId: exam._id,
        score: calculated.score,
        total: allQuestions.length,
        perTypeBreakdown: calculated.perTypeBreakdown,
        answers,
        mode,
        durationSeconds,
      };
    } else {
      throw new ApiError(400, 'Envía questionIds y respuestas para registrar un intento verificable.');
    }

    const attempt = await ExamAttempt.create(attemptData);
    return res.status(201).json(attempt.serialize());
  } catch (err) {
    return sendError('examAttempts:create', res, err);
  }
};

exports.generateFromDeckData = generateFromDeckData;
