const WEIGHTS = { accuracy: 0.40, retention: 0.20, fluidity: 0.15, volume: 0.15, resilience: 0.10 };
const TARGETS = { FLUID_MS: 3000, MAX_MS: 12000, MATURITY_REVIEWS: 20, HALF_LIFE_DAYS: 7 };

function getFluidityScore(ms) {
  if (!ms || ms <= TARGETS.FLUID_MS) return 1.0;
  if (ms >= TARGETS.MAX_MS) return 0.0;
  return 1 - ((ms - TARGETS.FLUID_MS) / (TARGETS.MAX_MS - TARGETS.FLUID_MS));
}

function getRetentionScore(lastDate) {
  if (!lastDate) return 0.5;
  const days = (Date.now() - new Date(lastDate).getTime()) / (1000 * 60 * 60 * 24);
  return Math.max(0.1, Math.exp(-(Math.LN2 / TARGETS.HALF_LIFE_DAYS) * days));
}

function getVolumeScore(reviews) {
  if (!reviews) return 0.0;
  return Math.min(1.0, Math.log1p(reviews) / Math.log1p(TARGETS.MATURITY_REVIEWS));
}

function getResilienceScore(errors) {
  if (!errors || errors === 0) return 1.0;
  return Math.max(0.0, Math.pow(0.5, errors));
}

function calculateRadarMetrics(items, isDeckLevel = false, currentReview = null) {
  const total = items.length;
  if (total === 0) return { accuracy: 0, speed: 0, reviews: 0, mastery: 0, confidence: 0, difficulty: 0, lastReview: null, knowledgeScore: 0 };

  let aggAccuracy = 0, aggSpeed = 0, aggReviews = 0, aggFluidity = 0, aggRetention = 0, aggResilience = 0, aggConfidence = 0;
  let reviewedCount = 0, latestReviewDate = null;

  items.forEach(item => {
    let metrics;

    if (isDeckLevel) {
      const hasHistory = item.totalReviews && item.totalReviews > 0;

      const cardSpeed = (currentReview && String(item._id) === String(currentReview.cardId))
        ? currentReview.responseTimeMs
        : (TARGETS.FLUID_MS * 1.5);

      metrics = {
        accuracy: hasHistory ? (1.0 - (item.difficulty ?? 0.3)) : 0,
        speed: hasHistory ? cardSpeed : 0,
        reviews: item.totalReviews ?? 0,
        confidence: hasHistory ? (item.easeFactor ?? 2.5) : 0,
        difficulty: item.difficulty ?? 0.3,
        lastReview: item.lastReviewedAt,
        fluidity: hasHistory ? getFluidityScore(cardSpeed) : 0,
        retention: hasHistory ? getRetentionScore(item.lastReviewedAt) : 0,
        resilience: hasHistory ? getResilienceScore(item.consecutiveErrors) : 0
      };

      if (hasHistory) reviewedCount++;
    } else {
      const hasData = item.knowledgeMetrics && item.knowledgeMetrics.reviews > 0;

      metrics = {
        accuracy: item.knowledgeMetrics?.accuracy ?? 0,
        speed: item.knowledgeMetrics?.speed ?? 0,
        reviews: item.knowledgeMetrics?.reviews ?? 0,
        confidence: item.knowledgeMetrics?.confidence ?? 0,
        difficulty: item.knowledgeMetrics?.difficulty ?? 0,
        lastReview: item.knowledgeMetrics?.lastReview,
        fluidity: hasData ? getFluidityScore(item.knowledgeMetrics?.speed) : 0,
        retention: hasData ? getRetentionScore(item.knowledgeMetrics?.lastReview) : 0,
        resilience: hasData ? (item.knowledgeMetrics?.mastery / 100) : 0
      };

      if (hasData) reviewedCount++;
    }

    aggAccuracy += metrics.accuracy;
    aggSpeed += metrics.speed;
    aggReviews += metrics.reviews;
    aggFluidity += metrics.fluidity;
    aggRetention += metrics.retention;
    aggResilience += metrics.resilience;
    aggConfidence += metrics.confidence;

    if (metrics.lastReview && (!latestReviewDate || new Date(metrics.lastReview) > new Date(latestReviewDate))) {
      latestReviewDate = metrics.lastReview;
    }
  });

  const avgAccuracy = aggAccuracy / total;
  const avgSpeed = reviewedCount > 0 ? (aggSpeed / reviewedCount) : 0;
  const avgFluidity = aggFluidity / total;
  const avgRetention = aggRetention / total;
  const avgResilience = aggResilience / total;
  const avgConfidence = aggConfidence / total;
  const avgDifficulty = reviewedCount > 0 ? (1.0 - (aggAccuracy / total)) : 1.0;

  const globalVolume = getVolumeScore(isDeckLevel ? (aggReviews / total) : aggReviews);

  let masteryScore =
    (avgAccuracy * WEIGHTS.accuracy) +
    (avgRetention * WEIGHTS.retention) +
    (avgFluidity * WEIGHTS.fluidity) +
    (globalVolume * WEIGHTS.volume) +
    (avgResilience * WEIGHTS.resilience);

  const mastery = reviewedCount === 0 ? 0 : Math.min(100, Math.max(0, Math.round(masteryScore * 100)));
  const knowledgeScore = parseFloat(((reviewedCount * avgAccuracy) / Math.max(1, aggReviews)).toFixed(2));

  return {
    accuracy: parseFloat(avgAccuracy.toFixed(2)),
    speed: Math.round(avgSpeed),
    reviews: aggReviews,
    mastery,
    confidence: parseFloat(avgConfidence.toFixed(2)),
    difficulty: parseFloat(avgDifficulty.toFixed(2)),
    lastReview: latestReviewDate,
    knowledgeScore
  };
}

module.exports = { calculateRadarMetrics, WEIGHTS, TARGETS, getFluidityScore, getRetentionScore, getVolumeScore, getResilienceScore };
