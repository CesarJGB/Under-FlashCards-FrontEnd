/**
 * backend/src/services/aiService.js
 * Servicio de Inteligencia Artificial optimizado para Under-FlashCards
 */

// Umbral a partir del cual Fase 2 usa el modelo razonador (mayor precisión, mayor latencia/costo).
const REASONER_THRESHOLD = parseInt(process.env.AI_REASONER_THRESHOLD, 10) || 20;

/**
 * FASE 1: Generador de Tarjetas Crudas
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
  const cards = parsed.cards || [];

  console.log(`[Fase 1 Raw Output] ${cards.length} tarjetas generadas:`);
  cards.forEach((c, i) => console.log(`  #${i}: ${c.question}`));

  return cards;
}

/**
 * FASE 2: Auditor y Crítico Estricto.
 * Usa deepseek-reasoner (razonamiento extendido) para lotes grandes, donde la
 * probabilidad de redundancia conceptual es mayor y justifica la latencia extra.
 * Usa deepseek-chat (rápido, temperature baja) para lotes chicos.
 */
async function criticizeAndRefineCards(originalText, rawCards, apiKey) {
  const useReasoner = rawCards.length > REASONER_THRESHOLD;
  const model = useReasoner ? 'deepseek-reasoner' : 'deepseek-chat';

  console.log(`[Fase 2] Usando modelo "${model}" para lote de ${rawCards.length} tarjetas (umbral: ${REASONER_THRESHOLD}).`);

  const baseBody = {
    model,
    response_format: { type: "json_object" },
    messages: [
      {
        role: 'system',
        content: `Eres un Supervisor de Control de Calidad Académica de Inteligencia Artificial. Tu objetivo es auditar un mazo completo de flashcards preliminares comparándolas minuciosamente con el Texto Fuente Original.

        Para evitar evaluaciones aisladas y asegurar la consistencia absoluta en el control de calidad, debes ejecutar obligatoriamente un proceso analítico de 4 pasos antes de rellenar el arreglo final.

        Debes responder con un objeto JSON que tenga exactamente esta estructura de raíz:
        {
          "proceso_analisis_4_pasos": {
            "paso_a_conceptos_clave": "Mapeo interno y breve de cada tarjeta preliminar con el núcleo de conocimiento exacto que evalúa",
            "paso_b_comparacion_redundancias": "Análisis cruzado explícito buscando pares que apunten al mismo concepto subyacente o dato clave aunque estén redactadas de forma totalmente distinta",
            "paso_c_verificacion_factual_esceptica": "Contraste duro con el Texto Fuente Original, partiendo de la premisa de que el lote preliminar tiene al menos un error factual o alucinación hasta confirmar lo contrario"
          },
          "cards": [
            {
              "question": "Texto de la pregunta (optimizado o el original)",
              "answer": "Texto de la respuesta (optimizado o el original)",
              "status": "sin_cambios" | "corregida" | "fusionada" | "eliminada",
              "reason": "Justificación obligatoria y detallada de la auditoría efectuada para esta tarjeta"
            }
          ]
        }

        REGLAS CRÍTICAS DE ACCIÓN PARA EL PASO D (Asignación de propiedades en 'cards'):
        1. CORREGIR ("status": "corregida"): Si la tarjeta presenta problemas de redacción, longitud excesiva, ambigüedad o falta de atomicidad (ej: preguntas demasiado abiertas o vagas), pero el dato central es verídico. Reescríbela para que sea directa, concisa y perfectamente atómica.
        2. ELIMINAR ("status": "eliminada"): Si la tarjeta presenta un error factual, altera de raíz los datos del documento o inventa fórmulas/conceptos que NO están presentes de forma explícita en el Texto Fuente Original. Elimínala directamente, no intentes salvarla.
        3. REDUNDANCIA CONCEPTUAL ("status": "fusionada"): Si en el 'paso_b' detectaste que dos tarjetas evalúan el mismo concepto básico subyacente, AUNQUE UNA LO PREGUNTE DESDE EL ÁNGULO OPUESTO O COMPLEMENTARIO (ej: "¿cuántos días tienes para hacer X a tiempo?" y "¿cuándo se considera X fuera de tiempo?" dependen del mismo dato numérico y son redundantes entre sí), mantén una sola tarjeta viva (como 'sin_cambios' o 'corregida') y marca la otra como 'fusionada', indicando con cuál colisionó.

        REGLA DE OBLIGATORIEDAD ABSOLUTA PARA "reason":
        La llave "reason" debe ser completada en TODOS los casos sin excepción. Si el estatus es "sin_cambios", debes explicar con precisión qué se verificó (ejemplo: 'Dato verificado en texto fuente, estructura perfectamente atómica y sin colisiones conceptuales detectadas tras el análisis cruzado con el lote').`
      },
      {
        role: 'user',
        content: JSON.stringify({
          textoFuenteOriginal: originalText,
          tarjetasPreliminares: rawCards
        })
      }
    ]
  };

  // deepseek-reasoner ignora `temperature`; solo se envía cuando usamos deepseek-chat.
  if (!useReasoner) {
    baseBody.temperature = 0.1;
  }

  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(baseBody)
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`[DeepSeek Critic Error]: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const message = data.choices?.[0]?.message;
  const refinedJson = message?.content?.trim() || "{}";

  if (message?.reasoning_content) {
    console.log('[Fase 2 Reasoning]', message.reasoning_content.slice(0, 2000));
  }

  const parsed = JSON.parse(refinedJson);
  const cards = parsed.cards || [];

  const counts = { sin_cambios: 0, corregida: 0, fusionada: 0, eliminada: 0 };
  cards.forEach((c, i) => {
    counts[c.status] = (counts[c.status] || 0) + 1;
    console.log(`[Fase 2 Audit] #${i} [${c.status?.toUpperCase()}] "${(c.question || '').slice(0, 60)}" → ${c.reason}`);
  });
  console.log('[Fase 2 Audit Summary]', counts);

  return cards;
}

module.exports = {
  generateRawCards,
  criticizeAndRefineCards
};
