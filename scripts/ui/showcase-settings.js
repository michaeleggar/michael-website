export const showcaseDefaults = {
  sizing: { growth: 1.1, textClearance: 24, bottomAnchored: true, fitToWindow: true, protectTextOnHover: true, matchCaptionToNav: false, captionBottomGap: 50 },
  layout: { curve: 'smile', maxWidth: 1600, spacing: 128, mobileSpacing: 108, curveDepth: 7, rotation: 3.8, baseline: 105, stagger: 25, stageHeight: 410, mobileHeight: 330 },
  photos: { workWidth: 271, mobileWidth: 210, workAspect: 1.45, artHeight: 0.87, artMaxWidth: 1.15, workRadius: 14, artRadius: 7, workFit: 'cover' },
  hover: { ripple: true, reach: 2.1, lift: 40, spread: 57, tilt: 3.6, neighborScale: 1.055, verticalInfluence: true },
  spotlight: { popToFront: true, lift: 12, scale: 1.17, rotationFollow: 0.15, showLabels: true },
  motion: { spring: { type: 'spring', stiffness: 701, damping: 29, mass: 1 }, reducedMotionPreview: false },
  appearance: { shadow: true, shadowOffset: 12, shadowBlur: 24, shadowOpacity: 55, labelSize: 13, labelGap: 12, detailSize: 11, customFrameColor: false, frameColor: '#28332e', inactiveBlur: false, blurAmount: 1.5, blurDuration: 290 },
  preview: { enabled: false, point: { x: 0, y: 0 } },
};
let current = structuredClone(showcaseDefaults);
export function getShowcaseSettings() { return current; }
export function setShowcaseSettings(values) {
  const next = structuredClone(current);
  for (const group of Object.keys(showcaseDefaults)) if (values[group]) next[group] = { ...next[group], ...structuredClone(values[group]) };
  current = next;
  document.dispatchEvent(new Event('showcase:settings'));
}
window.siteShowcase = {
  getDefaults: () => structuredClone(showcaseDefaults),
  getValues: () => structuredClone(current),
  setValues: setShowcaseSettings,
  replay: () => document.dispatchEvent(new Event('showcase:replay')),
};
document.dispatchEvent(new Event('showcase:ready'));
