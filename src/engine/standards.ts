/**
 * Industry & case standards used to suggest a realistic Day-1 (or TSA-exit) date.
 * Sources: the case (Rioja: 300+ activities / 8 workstreams; Phoenix: 90-day TSA
 * exit planning mandate) and anonymised PwC learning records. Editable here.
 */
export interface IndustryStandard {
  /** Days kept free after the last task for cut-over rehearsal and hypercare. */
  bufferDays: number;
  bufferWhy: string;
  /** Typical lead time for third-party consents (licences, regulators), in days. */
  consentLeadDays: number;
  consentWhy: string;
  /** Typical end-to-end length of this kind of programme. */
  typical: string;
}

export const INDUSTRY_STANDARDS: Record<string, IndustryStandard> = {
  Semiconductor: { bufferDays: 7, bufferWhy: 'cut-over rehearsal of design tools + 2 days hypercare before engineers return', consentLeadDays: 35, consentWhy: 'EDA vendors take ~5 weeks to consent to licence transfer (SEMI-03)', typical: 'Day-1 carve-outs of 20–50 apps typically need 12–16 weeks of readiness work' },
  'Financial services': { bufferDays: 14, bufferWhy: 'parallel run of card authorisation + regulator notification window', consentLeadDays: 30, consentWhy: 'regulators and card networks need ~30 days notice for platform changes', typical: 'TSA exits are planned within a 90-day mandate; 400+ app estates usually exit in 3–5 waves' },
  default: { bufferDays: 10, bufferWhy: 'cut-over rehearsal and hypercare', consentLeadDays: 30, consentWhy: 'typical third-party consent lead time', typical: 'Mid-size separations typically need 10–14 weeks of readiness work' },
};
export const standardFor = (industry: string) => INDUSTRY_STANDARDS[industry] ?? INDUSTRY_STANDARDS.default;
