import { Router } from 'express';
import * as constants from '../distribution/constants.js';

/**
 * Demo-only helper (no upstream counterpart): exposes the domain constants
 * so the frontend renders labels, lifecycle guards and redirect docs from
 * the same source of truth as the backend.
 */
export function metaRouter() {
  const router = Router();

  router.get('/meta/constants', (req, res) => {
    res.json({
      surveyStatus: constants.SURVEY_STATUS,
      surveyStatusLabels: constants.SURVEY_STATUS_LABELS,
      surveyStatusDescriptions: constants.SURVEY_STATUS_DESCRIPTIONS,
      settableSurveyStatuses: constants.SETTABLE_SURVEY_STATUSES,
      surveyStatusTransitions: constants.SURVEY_STATUS_TRANSITIONS,
      responseStatus: constants.RESPONSE_STATUS,
      responseStatusLabels: constants.RESPONSE_STATUS_LABELS,
      settableResponseStatuses: constants.SETTABLE_RESPONSE_STATUSES,
      providers: constants.PROVIDERS,
      gender: constants.GENDER,
      genderLabels: constants.GENDER_LABELS,
      panelistRedirects: constants.PANELIST_REDIRECTS,
      surveyUrlIdPlaceholder: constants.SURVEY_URL_ID_PLACEHOLDER,
    });
  });

  return router;
}
