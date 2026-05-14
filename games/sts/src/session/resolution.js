import { sortTimeline } from '../shared/timeline.js';

function buildDebugBundle(bundle = {}, index = 0) {
  return {
    index,
    rootEvent: bundle.rootEvent ?? null,
    timeline: sortTimeline(bundle.timeline ?? []).map(entry => ({ ...entry, bundleIndex: index })),
    patches: (bundle.patches ?? []).map(patch => ({ ...patch })),
  };
}

function buildDebugInfo({ bundles = [] } = {}) {
  const debugBundles = bundles.map((bundle, index) => buildDebugBundle(bundle, index));

  return {
    rootEvent: debugBundles.length === 1 ? debugBundles[0].rootEvent : null,
    rootEvents: debugBundles.map(bundle => bundle.rootEvent),
    timeline: sortTimeline(debugBundles.flatMap(bundle => bundle.timeline)),
    patches: debugBundles.flatMap(bundle => bundle.patches),
    bundles: debugBundles,
  };
}

export function buildStsResolution({ command = null, bundles = [] } = {}) {
  return {
    command,
    profile: 'sts',
    debug: buildDebugInfo({ bundles }),
  };
}
