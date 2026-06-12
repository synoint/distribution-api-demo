/**
 * Domain constants of the Syno Distribution API.
 *
 * Terminology bridge (the docs use the left term, the API uses the right):
 *   Project = "sample"   — top-level container; its limit caps completes
 *                          across ALL surveys under it combined.
 *   Survey  = "subset"   — one distribution with targeting, quotas, providers.
 *
 * Everything here reflects the API's documented behavior; treat the live API
 * as authoritative if values ever drift.
 */

/**
 * Survey (subset) lifecycle statuses.
 * A new survey starts in DRAFT (1). Launch it by PATCHing status to LIVE (3).
 * NEW (2) is a transitional state: launched, invitations going out, no
 * responses yet. HALTED (7) is set automatically when the incidence rate
 * drops too low — resume by setting LIVE again. COMPLETE (5) means fieldwork
 * stopped (cannot be restarted). CLOSED (6) is final and starts invoicing —
 * after that, response statuses can no longer be changed.
 */
export const SURVEY_STATUS = {
  DRAFT: 1,
  NEW: 2,
  LIVE: 3,
  PAUSED: 4,
  COMPLETE: 5,
  CLOSED: 6,
  HALTED: 7,
  CANCELLED: 8,
};

// Fallback labels only — the authoritative display names come from
// GET /reference/statuses. The frontend fetches that endpoint and
// overrides these.
export const SURVEY_STATUS_LABELS = {
  1: 'Draft',
  2: 'New',
  3: 'Live',
  4: 'Paused',
  5: 'Stopped',
  6: 'Closed',
  7: 'Halted',
  8: 'Cancelled',
};

/**
 * What each survey status means for a consumer. Display names come from
 * GET /reference/statuses; these explanations accompany them in the UI.
 */
export const SURVEY_STATUS_DESCRIPTIONS = {
  1: 'Created, not launched; freely modifiable. No invitations are sent.',
  2: 'Launched, invitations going out, no responses yet (transitional).',
  3: 'Fieldwork running, collecting responses. The only status you can set from Draft.',
  4: 'Paused by you; invitations stop. Resume any time by setting Live.',
  5: 'Fieldwork stopped; cannot be restarted. Also set automatically when the quota limits are reached and the survey (subset) is finished.',
  6: 'Final. Invoicing starts; response statuses can no longer be changed.',
  7: 'Auto-paused by the platform (incidence rate too low); resume by setting Live.',
  8: 'Cancelled.',
};

/**
 * Statuses a client is allowed to SET via PATCH …/subsets/{id}/status.
 * The API rejects anything outside [3, 4, 6] (Live, Paused, Closed).
 */
export const SETTABLE_SURVEY_STATUSES = [
  SURVEY_STATUS.LIVE,
  SURVEY_STATUS.PAUSED,
  SURVEY_STATUS.CLOSED,
];

/**
 * Allowed status transitions, as enforced by the API.
 * Key = current status, value = statuses reachable from it.
 */
export const SURVEY_STATUS_TRANSITIONS = {
  [SURVEY_STATUS.DRAFT]: [SURVEY_STATUS.LIVE],
  [SURVEY_STATUS.LIVE]: [SURVEY_STATUS.PAUSED, SURVEY_STATUS.COMPLETE, SURVEY_STATUS.CLOSED],
  [SURVEY_STATUS.PAUSED]: [SURVEY_STATUS.LIVE, SURVEY_STATUS.COMPLETE, SURVEY_STATUS.CLOSED],
  [SURVEY_STATUS.HALTED]: [SURVEY_STATUS.LIVE, SURVEY_STATUS.PAUSED, SURVEY_STATUS.COMPLETE, SURVEY_STATUS.CLOSED],
  [SURVEY_STATUS.COMPLETE]: [SURVEY_STATUS.CLOSED],
  [SURVEY_STATUS.CLOSED]: [],
};

/**
 * Per-response (respondent attempt) statuses. A response is created when a
 * panelist clicks the survey link; its GUID replaces the [ID] placeholder in
 * the survey URL. The client tracks these for reconciliation.
 */
export const RESPONSE_STATUS = {
  NEW: 0,
  IN_SURVEY: 1,
  SCREEN_OUT: 2,
  QUOTA_FULL: 3,
  QUALITY_TERMINATE: 4,
  COMPLETED: 5,
  TIMED_OUT: 6,
  GROUP_QUOTA_FULL: 11,
};

export const RESPONSE_STATUS_LABELS = {
  0: 'New',
  1: 'In survey',
  2: 'Screen-out',
  3: 'Quota full',
  4: 'Quality terminate',
  5: 'Completed',
  6: 'Timed out',
  11: 'Group quota full',
};

/**
 * Statuses a client may set during reconciliation via
 * PATCH …/responses/{guid}/status — e.g. reject a complete for bad quality
 * (QUALITY_TERMINATE) or compensate a wrongly screened respondent
 * (COMPLETED). Allowed only until the survey is Closed.
 */
export const SETTABLE_RESPONSE_STATUSES = [
  RESPONSE_STATUS.SCREEN_OUT,
  RESPONSE_STATUS.QUOTA_FULL,
  RESPONSE_STATUS.QUALITY_TERMINATE,
  RESPONSE_STATUS.COMPLETED,
  RESPONSE_STATUS.GROUP_QUOTA_FULL,
];

/**
 * Supply-source providers (sample marketplaces) selectable in a survey's
 * providers[] array. Percentages across one survey should total 100.
 * The authoritative list of providers available to YOUR account always
 * comes from GET /reference/providers.
 */
export const PROVIDERS = {
  CINT: 2,
  SYNO: 3,
  REP_DATA: 14,
  PURE_SPECTRUM: 15,
};

/** Gender targeting values (zero-based by API convention). */
export const GENDER = { ANY: 0, MALE: 1, FEMALE: 2 };

export const GENDER_LABELS = { 0: 'Any', 1: 'Male', 2: 'Female' };

/**
 * Where the CLIENT's survey must redirect panelists when they finish, for
 * any outcome. Registering the outcome at Syno drives respondent
 * remuneration and invoicing — skipping these redirects breaks billing.
 */
export const PANELIST_REDIRECTS = {
  complete: 'https://r.synoint.com/response/complete',
  screenout: 'https://r.synoint.com/response/screenout',
  quotaFull: 'https://r.synoint.com/response/quota_full',
  qualityScreenout: 'https://r.synoint.com/response/quality_screenout',
};

/**
 * Literal placeholder that must appear in a survey's url/testUrl. The API
 * replaces it with the response GUID (alphanumeric, ≤ 40 chars, unique per
 * response within one survey) when sending a panelist in. Capture and store
 * the GUID on survey entry — it is required later for reconciliation.
 */
export const SURVEY_URL_ID_PLACEHOLDER = '[ID]';
