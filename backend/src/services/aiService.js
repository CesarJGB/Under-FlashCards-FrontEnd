/**
 * backend/src/services/aiService.js
 * Servicio de Inteligencia Artificial optimizado para Under-FlashCards
 */

/**
 * FASE 1: Generador de Tarjetas Crudas (Insufla padding si está configurado)
 */
async function generateRawCards(text, targetCount, apiKey) {
  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      response_format: { type: "json_object" },
      temperature: 0.5,
      messages: [
        {
          role: 'system',
          content: `Eres un procesador educativo de alta precisión. Tu tarea es generar exactamente ${targetCount} flashcards en español basadas exclusivamente en el texto provesto por el usuario.
          Debes responder ÚNICAMENTE con un objeto JSON válido que contenga la propiedad "cards" mapeada a un arreglo de objetos. Cada objeto debe contener de manera obligatoria y exclusiva las llaves "question" y "answer" en formato string de texto plano.`
        },
        { role: 'user', content: text }
      ]
    })
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`[DeepSeek Generator Error]: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const rawJson = data.choices?.[0]?.message?.content?.trim() || "{}";
  const parsed = JSON.parse(rawJson);
  return parsed.cards || [];
}

/**
 * FASE 2: Auditor y Crítico Estricto (Manejo de Metadatos de Calidad)
 */
async function criticizeAndRefineCards(originalText, rawCards, apiKey) {
  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      response_format: { type: "json_object" },
      temperature: 0.1, // Ultra-determinista
      messages: [
        {
          role: 'system',
          content: `Eres un Supervisor de Control de Calidad Académica de Inteligencia Artificial. Tu objetivo es auditar un lote de flashcards preliminares comparándolas con el Texto Fuente Original.
          
          Debes procesar TODO el lote en esta única llamada y devolver obligatoriamente un objeto JSON con la propiedad "cards", la cual contiene un arreglo de objetos. Cada objeto DEBE incluir de forma estricta las siguientes cuatro llaves:
          - "question": El texto de la pregunta (optimizado o el original).
          - "answer": El texto de la respuesta (optimizado o el original).
          - "status": Un string exacto que debe ser uno de estos cuatro valores: "sin_cambios" | "corregida" | "fusionada" | "eliminada".
          - "reason": Un string breve en español explicando la razón de la acción (obligatorio si el status es corregida, fusionada o eliminada; vacío "" si es sin_cambios).

          REGLAS DE ACCIÓN EXPLÍCITAS:
          1. CORREGIR ("status": "corregida"): Aplícalo si la tarjeta tiene problemas de redacción, longitud excesiva, ambigüedad o falta de atomicidad, pero el dato central es verídico. Reescríbela para que sea concisa.
          2. ELIMINAR ("status": "eliminada"): Aplícalo de inmediato si la tarjeta presenta un error factual grave, inventa datos, fórmulas o conceptos que NO existen en el Texto Fuente Original. No intentes salvarla.
          3. REDUNDANCIA CONCEPTUAL ("status": "fusionada"): Compara los conceptos subyacentes. Si dos tarjetas evalúan el mismo núcleo de conocimiento (ej: una pregunta por la capital de un país y otra por la ubicación de su palacio de gobierno principal si el texto los unifica como el mismo dato clave), mantén solo una de ellas (márcala como "sin_cambios" o "corregida") y marca la redundante como "fusionada", detallando con qué otra tarjeta colisionó en la llave "reason".`
        },
        {
          role: 'user',
          content: JSON.stringify({
            textoFuenteOriginal: originalText,
            tarjetasPreliminares: rawCards
          })
        }
      ]
    })
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`[DeepSeek Critic Error]: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const refinedJson = data.choices?.[0]?.message?.content?.trim() || "{}";
  const parsed = JSON.parse(refinedJson);
  return parsed.cards || [];
}

module.exports = {
  generateRawCards,
  criticizeAndRefineCards
};
