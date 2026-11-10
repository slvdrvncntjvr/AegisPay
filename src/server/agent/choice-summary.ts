// Display hardening for already-public, non-thought step.text only. This cannot
// establish truth, financial state or authority. Never pass providerContent here.
export function publicChoiceSummary(text: string): { summary: string | null; summaryStatus: 'provided' | 'missing' | 'withheld' } {
  const summary = text.normalize('NFKC').replace(/\s+/gu, ' ').trim();
  if (!summary) return { summary: null, summaryStatus: 'missing' };
  // Refuse the whole input rather than truncate away a dangerous suffix. Normal
  // paragraph whitespace is collapsed; other controls and bidi marks are refused.
  const controls = [...text].some(c => /\p{Cc}|\p{Cf}/u.test(c) && !/[\r\n\t]/.test(c));
  if (summary.length > 280 || controls || /[<>{}]|\[|\]|[a-z][a-z0-9+.-]*:\/\/|\b[a-z][a-z0-9+.-]*:(?!\s)|www\./i.test(summary) ||
    /\b(paid|bought|purchased|payments?|funds?|money|settle(?:d|ment|ments)?|claim(?:ed|ing|s)?|refund(?:ed|s)?|escrow|balance|authoriz(?:ed|ation)|confirm(?:ed|ation)|fees?|stroops?|xlm|funded|transferred|successful|success|completed|verified)\b/i.test(summary) ||
    /\b(api[ _-]?key|secret|password|bearer|token|session|receipt|signature|checkpoint|providerContent|protected[ _-]?report|AEGIS_PRIVATE\w*)\b|[a-z0-9_+/-]{32,}|[a-f0-9]{8}-[a-f0-9-]{27,}/i.test(summary)) {
    return { summary: null, summaryStatus: 'withheld' };
  }
  return { summary, summaryStatus: 'provided' };
}
