#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const backendDirectory = path.resolve(__dirname, '..');
const requestTimeoutMs = 120000;

require('dotenv').config({ path: path.join(backendDirectory, '.env') });

const openAiBaseUrl = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '');
const openAiEndpoint = `${openAiBaseUrl}/chat/completions`;
const evaluatorModel = process.env.OPENAI_MODEL || process.env.OPENAI_EVALUATOR_MODEL || 'gpt-4o';

function readSample(fileName) {
  const filePath = path.join(__dirname, fileName);
  if (!fs.existsSync(filePath)) {
    throw new Error(`No existe ${filePath}. Ejecuta primero extractSamples.js.`);
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new Error(`No se pudo leer ${filePath} como JSON.`, { cause: error });
  }
}

function getMessageContent(data) {
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content === 'string' && content.trim()) return content.trim();
  if (Array.isArray(content)) {
    const text = content
      .filter((part) => part?.type === 'text' && typeof part.text === 'string')
      .map((part) => part.text)
      .join('')
      .trim();
    if (text) return text;
  }
  throw new Error('OpenAI no devolvió contenido en la respuesta.');
}

function parseJsonResponse(content) {
  const fencedJson = content.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  try {
    return JSON.parse(fencedJson ? fencedJson[1] : content);
  } catch (error) {
    throw new Error('El evaluador no devolvió JSON válido.', { cause: error });
  }
}

function validateEvaluation(result) {
  const validWinners = new Set(['A', 'B', 'Tie']);
  for (const key of ['set_a', 'set_b']) {
    const evaluation = result?.[key];
    if (!evaluation || !Number.isInteger(evaluation.score) || evaluation.score < 1 || evaluation.score > 10) {
      throw new Error(`La evaluación ${key} no contiene score entero entre 1 y 10.`);
    }
    if (typeof evaluation.justification !== 'string' || !evaluation.justification.trim()) {
      throw new Error(`La evaluación ${key} no contiene una justificación válida.`);
    }
  }
  if (!validWinners.has(result?.winner)) {
    throw new Error('La evaluación no contiene winner A, B o Tie.');
  }
  return {
    set_a: {
      score: result.set_a.score,
      justification: result.set_a.justification,
    },
    set_b: {
      score: result.set_b.score,
      justification: result.set_b.justification,
    },
    winner: result.winner,
  };
}

function buildPrompt(sampleV1, sampleV2) {
  return `Actúa como un evaluador académico estricto. Te voy a pasar dos sets de flashcards (Set A y Set B) generadas a partir del mismo texto. Evalúa cada set con una puntuación del 1 al 10 basándote en esta rúbrica:
1. Atomicidad (Una sola idea por tarjeta).
2. Claridad (Pregunta recuperable y respuesta autocontenida).
3. Fidelidad (Sin alucinaciones, basado estrictamente en el texto).
4. Dificultad pedagógica (No es trivial ni excesivamente compleja).

Set A:
${JSON.stringify(sampleV1, null, 2)}

Set B:
${JSON.stringify(sampleV2, null, 2)}

Devuelve un JSON válido con la estructura: { "set_a": { "score": int, "justification": "string" }, "set_b": { "score": int, "justification": "string" }, "winner": "A" | "B" | "Tie" }`;
}

async function callOpenAi(prompt, apiKey) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
  try {
    const response = await fetch(openAiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: evaluatorModel,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: 'Responde únicamente con el objeto JSON solicitado, sin markdown ni texto adicional.',
          },
          { role: 'user', content: prompt },
        ],
      }),
      signal: controller.signal,
    });
    const body = await response.text();
    if (!response.ok) {
      throw new Error(`OpenAI respondió HTTP ${response.status}: ${body}`);
    }
    return parseJsonResponse(getMessageContent(JSON.parse(body)));
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(`La evaluación excedió el timeout de ${requestTimeoutMs / 1000} segundos.`, { cause: error });
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function main() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('Falta OPENAI_API_KEY en el entorno o en backend/.env.');
  }

  const sampleV1 = readSample('sample_v1.json');
  const sampleV2 = readSample('sample_v2.json');
  console.log(`[evaluate-quality] Modelo evaluador: ${evaluatorModel}`);
  const rawEvaluation = await callOpenAi(buildPrompt(sampleV1, sampleV2), apiKey);
  const evaluation = validateEvaluation(rawEvaluation);
  console.log('[evaluate-quality] Resultado:');
  console.log(JSON.stringify(evaluation, null, 2));
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`[evaluate-quality] ${error.stack || error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  buildPrompt,
  main,
  parseJsonResponse,
  validateEvaluation,
};
