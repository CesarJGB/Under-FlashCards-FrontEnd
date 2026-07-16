export async function readAiGenerationProgress(response, onProgress) {
  if (!response.body) {
    throw new Error('No se pudo recibir el progreso de la generación con IA.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let completion = null;

  const processEvent = (rawEvent) => {
    const event = rawEvent.replace(/\r/g, '');
    const eventType = event.match(/^event:\s*(.+)$/m)?.[1]?.trim();
    const data = event.match(/^data:\s*(.+)$/m)?.[1];
    if (!eventType || !data) return;

    let payload;
    try {
      payload = JSON.parse(data);
    } catch {
      throw new Error('La generación con IA devolvió un progreso inválido.');
    }

    if (eventType === 'progress') {
      onProgress(payload);
    } else if (eventType === 'complete') {
      completion = payload;
    } else if (eventType === 'error') {
      const reference = payload?.runId ? ` (referencia ${payload.runId})` : '';
      const error = new Error(`${payload?.error || 'La IA no pudo generar las preguntas.'}${reference}`);
      error.partialQuestionCount = Number(payload?.partialQuestionCount) || 0;
      error.runId = payload?.runId || null;
      throw error;
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
    buffer = buffer.replace(/\r/g, '');

    let separatorIndex = buffer.indexOf('\n\n');
    while (separatorIndex !== -1) {
      processEvent(buffer.slice(0, separatorIndex));
      buffer = buffer.slice(separatorIndex + 2);
      separatorIndex = buffer.indexOf('\n\n');
    }

    if (done) break;
  }

  if (!completion) {
    throw new Error('La generación con IA terminó sin confirmar los resultados creados.');
  }
  return completion;
}
