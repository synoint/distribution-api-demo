import { ref } from 'vue';
import { api } from '@/api';

/**
 * Domain constants shared by all components, fetched once.
 *
 * Structural facts (status ids, allowed transitions, settable enums,
 * redirect URLs) come from the demo backend (/meta/constants). Display
 * LABELS for survey statuses and genders come live from the API's own
 * reference endpoints — GET /reference/statuses and GET /reference/genders —
 * so the UI always shows exactly what the API calls each value. The backend
 * labels are only a fallback if those lookups fail.
 */
const constants = ref(null);
let pending = null;

export function useConstants() {
  if (!constants.value && !pending) {
    pending = Promise.all([
      api.get('/meta/constants'),
      api.get('/reference/statuses').catch(() => null),
      api.get('/reference/genders').catch(() => null),
    ]).then(([meta, statuses, genders]) => {
      if (statuses?.statuses) {
        meta.surveyStatusLabels = Object.fromEntries(
          statuses.statuses.map((status) => [status.id, status.name]),
        );
      }
      if (genders?.genders) {
        meta.genderLabels = Object.fromEntries(
          genders.genders.map((gender) => [gender.id, gender.name]),
        );
      }
      constants.value = meta;
      pending = null;
    });
  }
  return constants;
}
