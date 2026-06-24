/**
 * Servicio de Inteligencia Artificial para Under-FlashCards
 * Implementa el patrón Generator-Critic utilizando la API oficial de DeepSeek.
 */

/**
 * Fase 1: Generación de la propuesta inicial de tarjetas.
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
      temperature: 0.5, // Balance ideal entre creatividad y precisión académica
      messages: [
        {
          role: 'system',
          content: `Eres un procesador educativo de alta precisión. Tu tarea es generar exactamente ${targetCount} flashcards en español basadas exclusivamente en el texto provisto por el usuario.
          Debes responder ÚNICAMENTE con un objeto JSON válido que contenga la propiedad "cards" mapeada a un arreglo de objetos. Cada objeto debe contener obligatoriamente las llaves "question" y "answer" en formato string de texto plano. No inyectes bloques markdown ni texto explicativo adicional.`
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
  
  if (!Array.isArray(parsed.cards)) {
    throw new Error('El generador no devolvió la estructura de tarjetas esperada.');
  }
  return parsed.cards;
}

/**
 * Fase 2: Crítica, deduplicación y control de calidad factual.
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
      temperature: 0.1, // Temperatura ultra-baja para máxima fidelidad lógica y cero inventiva
      messages: [
        {
          role: 'system',
          content: `Eres un Supervisor de Control de Calidad Académica de Inteligencia Artificial. Tu objetivo es revisar, corregir, filtrar y optimizar un conjunto de flashcards preliminares basándote en el texto fuente original.
          
          REGLAS DE EVALUACIÓN OBLIGATORIAS:
          1. DETECCIÓN DE REDUNDANCIAS: Si dos o más tarjetas evalúan exactamente el mismo concepto o tienen respuestas casi idénticas, fusiónalas en una sola o quédate únicamente con la mejor redactada.
          2. CORRECCIÓN FACTUAL: Contrasta cada pregunta y respuesta con el Texto Fuente Original. Si hay errores, datos tergiversados o alucinaciones, corrígelos inmediatamente. Si la tarjeta inventa conceptos que no están en el texto original, elimínala por completo.
          3. SIMPLICIDAD PEDAGÓGICA: Asegúrate de que las preguntas sean atómicas, directas y concisas. Evita rodeos gramaticales.
          
          Debes responder ÚNICAMENTE con un objeto JSON válido que contenga la propiedad "cards" mapeada al arreglo de objetos refinados finales (que tengan exclusivamente las llaves "question" y "answer"). No agregues comentarios extra.`
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

  if (!Array.isArray(parsed.cards)) {
    throw new Error('El crítico no devolvió el formato simétrico requerido.');
  }
  return parsed.cards;
}

module.exports = {
  generateRawCards,
  criticizeAndRefineCards
};
