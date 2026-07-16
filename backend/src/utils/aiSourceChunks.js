const MIN_USEFUL_CHUNK_LENGTH = 1500;

function toPositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function findSplitIndex(text, maximumLength) {
  const searchLimit = Math.min(text.length, maximumLength);
  const sample = text.slice(0, searchLimit + 1);
  const minimumLength = Math.max(1, Math.floor(searchLimit * 0.8));
  const boundaryPatterns = [
    /\n(?=--- \[Texto de la Pagina \d+\] ---)/g,
    /\n\s*\n+/g,
    /[.!?;:][)\]"']?\s+/g,
    /\s+/g,
  ];

  for (const pattern of boundaryPatterns) {
    let splitIndex = 0;
    let match;
    while ((match = pattern.exec(sample))) {
      const candidate = match.index + match[0].length;
      if (candidate >= minimumLength && candidate <= maximumLength) {
        splitIndex = candidate;
      }
    }
    if (splitIndex > 0) return splitIndex;
  }

  return maximumLength;
}

function splitByLength(text, maximumLength) {
  const chunks = [];
  let remaining = text.trim();

  while (remaining.length > maximumLength) {
    const splitIndex = findSplitIndex(remaining, maximumLength);
    const chunk = remaining.slice(0, splitIndex).trim();

    if (!chunk) {
      chunks.push(remaining.slice(0, maximumLength));
      remaining = remaining.slice(maximumLength).trim();
      continue;
    }

    chunks.push(chunk);
    remaining = remaining.slice(splitIndex).trim();
  }

  if (remaining) chunks.push(remaining);
  return chunks;
}

function chunkSourceText(sourceText, desiredChunkCount = 1, maximumChunkLength = 30000) {
  if (typeof sourceText !== 'string') {
    throw new TypeError('El texto fuente debe ser un string.');
  }

  const text = sourceText.trim();
  if (!text) return [];

  const desiredCount = toPositiveInteger(desiredChunkCount, 1);
  const maximumLength = toPositiveInteger(maximumChunkLength, 30000);
  const targetChunkLength = Math.min(
    maximumLength,
    Math.max(MIN_USEFUL_CHUNK_LENGTH, Math.ceil(text.length / desiredCount))
  );

  return splitByLength(text, targetChunkLength);
}

function distributeCandidateTargets(total, count) {
  const base = Math.floor(total / count);
  const remainder = total % count;
  return Array.from({ length: count }, (_, index) => base + (index < remainder ? 1 : 0));
}

function calculateTargetPadding(targetCount, batchSize, { factor = 0, maximum = 0, perBatch = 0 } = {}) {
  const target = toPositiveInteger(targetCount, 1);
  const normalizedBatchSize = toPositiveInteger(batchSize, 1);
  const normalizedFactor = Number.isFinite(factor) ? Math.max(0, factor) : 0;
  const normalizedMaximum = Math.max(0, Number.parseInt(maximum, 10) || 0);
  const normalizedPerBatch = Math.max(0, Number.parseInt(perBatch, 10) || 0);
  const factorPadding = Math.ceil(target * normalizedFactor);
  let padding = Math.min(normalizedMaximum, factorPadding);
  let batchCount = Math.ceil((target + padding) / normalizedBatchSize);

  for (let iteration = 0; iteration < 10; iteration += 1) {
    const nextPadding = Math.min(
      normalizedMaximum,
      Math.max(factorPadding, batchCount * normalizedPerBatch)
    );
    const nextBatchCount = Math.ceil((target + nextPadding) / normalizedBatchSize);
    if (nextPadding === padding && nextBatchCount === batchCount) break;
    padding = nextPadding;
    batchCount = nextBatchCount;
  }

  return { padding, batchCount };
}

function selectDocumentsAcrossChunks(documentsByChunk, targetCount) {
  const target = toPositiveInteger(targetCount, 1);
  const chunks = Array.from(documentsByChunk.entries())
    .map(([sourceChunkIndex, documents]) => ({
      sourceChunkIndex: Number(sourceChunkIndex),
      documents: Array.isArray(documents) ? documents : [],
    }))
    .filter((chunk) => chunk.documents.length > 0)
    .sort((first, second) => first.sourceChunkIndex - second.sourceChunkIndex);

  const availableDocumentCount = chunks.reduce((total, chunk) => total + chunk.documents.length, 0);
  const selectionCount = Math.min(target, availableDocumentCount);
  if (selectionCount === 0) return [];

  if (chunks.length > selectionCount) {
    if (selectionCount === 1) {
      return [chunks[Math.floor((chunks.length - 1) / 2)].documents[0]];
    }

    return Array.from({ length: selectionCount }, (_, index) => {
      const chunkIndex = Math.round(index * (chunks.length - 1) / (selectionCount - 1));
      return chunks[chunkIndex].documents[0];
    });
  }

  const offsets = new Array(chunks.length).fill(0);
  const selected = [];
  while (selected.length < selectionCount) {
    let added = false;
    for (let index = 0; index < chunks.length && selected.length < selectionCount; index += 1) {
      const document = chunks[index].documents[offsets[index]];
      if (!document) continue;
      selected.push(document);
      offsets[index] += 1;
      added = true;
    }
    if (!added) break;
  }

  return selected;
}

function buildGenerationBatches(sourceText, candidateTarget, batchSize, maximumChunkLength) {
  const target = toPositiveInteger(candidateTarget, 1);
  const maximumBatchSize = toPositiveInteger(batchSize, 1);
  const desiredBatchCount = Math.ceil(target / maximumBatchSize);
  const sourceChunks = chunkSourceText(sourceText, desiredBatchCount, maximumChunkLength);

  if (sourceChunks.length === 0) return { candidateTarget: 0, sourceChunks, batches: [] };

  // A large document gets at least one candidate per segment so later pages are not ignored.
  const plannedCandidateTarget = Math.max(target, sourceChunks.length);
  const taskCount = Math.max(sourceChunks.length, Math.ceil(plannedCandidateTarget / maximumBatchSize));
  const targets = distributeCandidateTargets(plannedCandidateTarget, taskCount);

  return {
    candidateTarget: plannedCandidateTarget,
    sourceChunks,
    batches: targets.map((targetCount, index) => {
      const sourceChunkIndex = index % sourceChunks.length;
      const sourceChunk = sourceChunks[sourceChunkIndex];
      return {
        index,
        number: index + 1,
        targetCount,
        sourceChunk,
        sourceChunkIndex: sourceChunkIndex + 1,
        sourceChunkCount: sourceChunks.length,
        sourceCharCount: sourceChunk.length,
      };
    }),
  };
}

module.exports = {
  buildGenerationBatches,
  calculateTargetPadding,
  chunkSourceText,
  selectDocumentsAcrossChunks,
};
