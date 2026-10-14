// Browser-safe entry `@cv/core/offer` (Zod-free, like `@cv/core/selection` and `@cv/core/export`):
// cleaning and flagging of an offer (untrusted data, §7.5), and the coverage of its terms (§6.8).
export * from './offer-text.js';
export * from './coverage.js';
export { normalizeForMatch, sameTerm } from './text/normalize.js';
