export const BOX_INTERVAL_DAYS = [0, 1, 3, 7, 14];
export const TARGET_BOX = BOX_INTERVAL_DAYS.length;

export function defaultProgressState(itemId) {
  return {
    id: itemId,
    box: 1,
    dueAt: 0,
    attempts: 0,
    correct: 0,
  };
}

export function isDue(progressItem, now = Date.now()) {
  return (progressItem?.dueAt ?? 0) <= now;
}

export function evaluateAnswer(progressItem, isCorrect, now = Date.now()) {
  const current = progressItem ?? defaultProgressState("");
  const nextBox = isCorrect
    ? Math.min(current.box + 1, TARGET_BOX)
    : 1;

  const nextDueAt =
    now + BOX_INTERVAL_DAYS[nextBox - 1] * 24 * 60 * 60 * 1000;

  return {
    ...current,
    box: nextBox,
    dueAt: nextDueAt,
    attempts: current.attempts + 1,
    correct: current.correct + (isCorrect ? 1 : 0),
  };
}

export function isCompleted(progressMap, items) {
  return items.every((item) => (progressMap[item.id]?.box ?? 1) >= TARGET_BOX);
}
