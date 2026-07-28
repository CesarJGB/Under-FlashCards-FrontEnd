// backend/src/services/semantic/providers/OpenAIEmbedder.js

class OpenAIEmbedder {
  /**
   * @param {string} apiKey 
   */
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.model = 'text-embedding-3-small';
  }

  /**
   * @param {string[]} texts 
   * @param {AbortSignal} [signal] 
   * @returns {Promise<number[][]>}
   */
  async embed(texts, signal) {
    if (!texts || texts.length === 0) return [];

    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.model,
        input: texts
      }),
      signal
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`OpenAI Embeddings API Error ${response.status}: ${errorBody}`);
    }

    const data = await response.json();
    
    if (!data.data || data.data.length !== texts.length) {
      throw new Error('INVALID_EMBEDDING_RESPONSE: La respuesta no coincide con el número de textos.');
    }

    return data.data
      .sort((a, b) => a.index - b.index)
      .map(item => item.embedding);
  }
}

module.exports = { OpenAIEmbedder };
