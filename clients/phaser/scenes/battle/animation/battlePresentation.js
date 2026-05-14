function sameClipBatchContext(left, right) {
  if (!left || !right) return false;
  return (left.refs?.sequenceId ?? null) === (right.refs?.sequenceId ?? null)
    && (left.refs?.procSource ?? null) === (right.refs?.procSource ?? null);
}

function isDrawStep(step) {
  return step?.kind === 'card_moved' && step?.data?.from === 'drawPile' && step?.data?.to === 'hand';
}

function getZoneKind(step) {
  if (step?.kind !== 'card_moved') return null;
  if (step?.data?.to === 'discardPile') return 'discarded';
  if (step?.data?.to === 'exhaustPile') return 'exhausted';
  return null;
}

function buildDrawBatch(steps, startIndex) {
  const batch = [steps[startIndex]];
  let index = startIndex;
  const firstStep = steps[startIndex];

  while (
    isDrawStep(steps[index + 1])
    && sameClipBatchContext(firstStep, steps[index + 1])
  ) {
    index += 1;
    batch.push(steps[index]);
  }

  return {
    nextIndex: index,
    clip: { kind: 'draw_batch', steps: batch },
  };
}

function buildZoneBatch(steps, startIndex) {
  const batch = [steps[startIndex]];
  let index = startIndex;
  const firstStep = steps[startIndex];
  const zoneKind = getZoneKind(firstStep);

  while (
    getZoneKind(steps[index + 1]) === zoneKind
    && sameClipBatchContext(firstStep, steps[index + 1])
  ) {
    index += 1;
    batch.push(steps[index]);
  }

  return {
    nextIndex: index,
    clip: {
      kind: 'zone_batch',
      zoneKind,
      steps: batch,
    },
  };
}

function isSequenceRootStep(step) {
  const sequenceId = step?.refs?.sequenceId ?? null;
  const sequenceKind = step?.refs?.sequenceKind ?? null;
  return !!sequenceId && sequenceKind === step?.kind;
}

function buildSequenceClip(steps, startIndex) {
  const rootStep = steps[startIndex];
  const sequenceId = rootStep?.refs?.sequenceId ?? null;
  const sequenceSteps = [];
  let index = startIndex;

  while (index + 1 < steps.length && steps[index + 1]?.refs?.sequenceId === sequenceId) {
    index += 1;
    sequenceSteps.push(steps[index]);
  }

  if (sequenceSteps.length === 0) {
    return {
      nextIndex: startIndex,
      clip: { kind: 'single', step: rootStep },
    };
  }

  return {
    nextIndex: index,
    clip: {
      kind: 'sequence',
      sequenceKind: rootStep.refs?.sequenceKind ?? rootStep.kind,
      rootStep,
      clips: buildBattleClips(sequenceSteps, { allowSequences: false }),
    },
  };
}

export function buildBattleClips(steps = [], { allowSequences = true } = {}) {
  const clips = [];

  for (let index = 0; index < steps.length; index += 1) {
    const step = steps[index];

    if (allowSequences && isSequenceRootStep(step)) {
      const result = buildSequenceClip(steps, index);
      clips.push(result.clip);
      index = result.nextIndex;
      continue;
    }

    if (isDrawStep(step)) {
      const result = buildDrawBatch(steps, index);
      clips.push(result.clip);
      index = result.nextIndex;
      continue;
    }

    const zoneKind = getZoneKind(step);
    if (zoneKind) {
      const result = buildZoneBatch(steps, index);
      clips.push(result.clip);
      index = result.nextIndex;
      continue;
    }

    clips.push({ kind: 'single', step });
  }

  return clips;
}

