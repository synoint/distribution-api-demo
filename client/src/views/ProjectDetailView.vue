<script setup>
import { onMounted, reactive, computed, ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { api } from '@/api';
import { useAsync } from '@/composables/useAsync';
import EndpointBadge from '@/components/EndpointBadge.vue';
import StatusBadge from '@/components/StatusBadge.vue';
import StatsGrid from '@/components/StatsGrid.vue';
import JsonPreview from '@/components/JsonPreview.vue';
import ConfirmDialog from '@/components/ConfirmDialog.vue';

const props = defineProps({ sampleId: { type: String, required: true } });
const router = useRouter();
const route = useRoute();

// GET /samples/{id} does not say whether a project is closed/archived, so
// the initial state comes from the list it was opened from; the lifecycle
// actions below then update it from their {closedAt, archivedAt} response.
const projectState = ref(
  ['closed', 'archived'].includes(route.query.source) ? route.query.source : 'active',
);
const isReadOnly = computed(() => projectState.value !== 'active');

// GET /samples/{id} — note: its `subsets` field contains IRI strings
// ("/samples/{id}/subsets/{sid}"), not embedded objects…
const project = useAsync(() => api.get(`/samples/${props.sampleId}`));
// …so the surveys table comes from the dedicated collection endpoint,
// which returns full subset objects.
const surveyList = useAsync(() => api.get(`/samples/${props.sampleId}/subsets`));
// GET /samples/{id}/statistics — live counters incl. accrued cost.
const stats = useAsync(() => api.get(`/samples/${props.sampleId}/statistics`));

const edit = reactive({ name: '', limit: null });
onMounted(async () => {
  await Promise.all([project.run(), surveyList.run(), stats.run()]);
  edit.name = project.data.value.name;
  edit.limit = project.data.value.limit;
});

/**
 * PATCH /samples/{id} — only `name` and `limit` are mutable, at any time.
 * Business rule: limit can never go below completes already achieved.
 */
const save = useAsync(async () => {
  const updated = await api.patch(`/samples/${props.sampleId}`, {
    name: edit.name,
    limit: Number(edit.limit),
  });
  await project.run();
  return updated;
});

const surveys = computed(() => surveyList.data.value?.subsets ?? []);

/**
 * Project lifecycle — body-less PATCH actions, one step at a time:
 *   Active ──close──► Closed ──archive──► Archived
 *   Active ◄─restore── Closed ◄─restore── Archived
 * Each answers {id, closedAt, archivedAt}; disallowed steps answer 409.
 */
const LIFECYCLE_ACTIONS = {
  close: {
    label: 'Close project',
    danger: true,
    from: ['active'],
    confirm: 'Closing ends fieldwork for the whole project: every launched survey is closed '
      + '(final — invoicing starts) and every Draft survey is permanently deleted.',
  },
  archive: {
    label: 'Archive project',
    from: ['closed'],
    confirm: 'Archiving freezes the project\'s statistics as a snapshot and moves it to the '
      + 'archived list. You can restore it back to Closed later.',
  },
  restore: {
    label: 'Restore',
    from: ['closed', 'archived'],
    confirm: 'Restoring moves the project one step back: Archived → Closed, or Closed → Active. '
      + 'Closed surveys stay closed and deleted drafts do not come back; re-activating can be '
      + 'refused if your account already has the maximum number of active projects.',
  },
};
const availableActions = computed(() =>
  Object.entries(LIFECYCLE_ACTIONS)
    .filter(([, action]) => action.from.includes(projectState.value))
    .map(([name, action]) => ({ name, ...action })));

const pendingAction = ref(null);
const lifecycleDialog = ref(null);
function askLifecycle(name) {
  pendingAction.value = name;
  lifecycleDialog.value.open();
}
const lifecycle = useAsync(async () => {
  const result = await api.patch(`/samples/${props.sampleId}/${pendingAction.value}`);
  projectState.value = result.archivedAt ? 'archived' : result.closedAt ? 'closed' : 'active';
  // Keep the URL in sync so a reload shows the same state.
  router.replace({
    query: projectState.value === 'active' ? {} : { ...route.query, source: projectState.value },
  });
  // Closing changes the surveys (launched → Closed, drafts deleted).
  await Promise.all([surveyList.run(), stats.run()]);
  return result;
});
</script>

<template>
  <div class="page">
    <p><RouterLink to="/">← All projects</RouterLink></p>

    <p v-if="project.loading.value" class="muted">Loading project…</p>
    <p v-else-if="project.error.value" class="error-text">{{ project.error.value.message }}</p>

    <template v-else-if="project.data.value">
      <h1>{{ project.data.value.name }} <span class="muted">— project #{{ project.data.value.id }}</span></h1>
      <EndpointBadge method="GET" path="/samples/{id}" />
      <EndpointBadge method="PATCH" path="/samples/{id}" />

      <div v-if="isReadOnly" class="warn-banner">
        This project is <strong>{{ projectState }}</strong> —
        <code>PATCH /samples/{id}</code> returns <code>409 Conflict</code> for any non-active sample.
        Submit the form below to see the rejection live.
      </div>

      <div class="card">
        <div class="spread">
          <h2 style="margin-top: 0">Project lifecycle</h2>
          <span class="state-pill" :class="projectState">{{ projectState }}</span>
        </div>
        <EndpointBadge method="PATCH" path="/samples/{id}/close" />
        <EndpointBadge method="PATCH" path="/samples/{id}/archive" />
        <EndpointBadge method="PATCH" path="/samples/{id}/restore" />
        <p class="muted">
          Active → <strong>Closed</strong> → <strong>Archived</strong>, one step at a time; restore
          goes one step back. Closing cascades to the surveys: launched ones are closed, drafts are
          deleted. Any step that isn't allowed from the current state is rejected with
          <code>409</code>.
        </p>
        <div class="row">
          <button
            v-for="action in availableActions"
            :key="action.name"
            :class="{ danger: action.danger, secondary: !action.danger && action.name === 'restore' }"
            :disabled="lifecycle.loading.value"
            @click="askLifecycle(action.name)"
          >{{ action.label }}</button>
        </div>
        <p v-if="lifecycle.error.value" class="error-text">{{ lifecycle.error.value.message }}</p>
        <JsonPreview
          v-if="lifecycle.data.value"
          :title="`Response from PATCH /samples/{id}/${pendingAction}`"
          :value="lifecycle.data.value"
        />

        <ConfirmDialog
          ref="lifecycleDialog"
          :title="`${LIFECYCLE_ACTIONS[pendingAction]?.label ?? ''}?`"
          :confirm-label="`Yes, ${pendingAction ?? ''}`"
          :danger="LIFECYCLE_ACTIONS[pendingAction]?.danger"
          @confirm="lifecycle.run"
        >
          <p>{{ LIFECYCLE_ACTIONS[pendingAction]?.confirm }}</p>
        </ConfirmDialog>
      </div>

      <div class="card">
        <h2 style="margin-top: 0">Project settings</h2>
        <p class="muted">
          Only <code>name</code> and <code>limit</code> can be changed. The limit can never be set
          below the number of completes the project has already achieved.
        </p>
        <form class="row" @submit.prevent="save.run">
          <label class="field">
            <span>Name</span>
            <input v-model="edit.name" required maxlength="255" />
          </label>
          <label class="field">
            <span>Limit</span>
            <input v-model="edit.limit" type="number" min="1" required style="max-width: 9rem" />
          </label>
          <button :disabled="save.loading.value">Save changes</button>
        </form>
        <p v-if="save.error.value" class="error-text">{{ save.error.value.message }}</p>
        <JsonPreview v-if="save.data.value" title="Response from PATCH /samples/{id}" :value="save.data.value" />
      </div>

      <div class="spread">
        <h2>Surveys <span class="muted">(subsets)</span></h2>
        <button
          :disabled="isReadOnly"
          :title="isReadOnly ? 'The API rejects new surveys on a closed or archived project (409)' : undefined"
          @click="router.push({ name: 'survey-create', params: { sampleId } })"
        >New survey</button>
      </div>
      <EndpointBadge method="GET" path="/samples/{id}/subsets" />
      <p v-if="surveyList.loading.value" class="muted">Loading surveys…</p>
      <p v-else-if="surveyList.error.value" class="error-text">{{ surveyList.error.value.message }}</p>
      <p v-else-if="!surveys.length" class="muted">No surveys yet — create one to define targeting, quotas and providers.</p>
      <table v-else>
        <thead>
          <tr><th>ID</th><th>Name</th><th>Status</th><th>Limit</th><th>Country</th><th>LOI</th><th>IR</th><th>Completed</th></tr>
        </thead>
        <tbody>
          <tr
            v-for="survey in surveys"
            :key="survey.id"
            class="clickable"
            @click="router.push({ name: 'survey-detail', params: { sampleId, subsetId: survey.id }, query: isReadOnly ? { project: projectState } : {} })"
          >
            <td>{{ survey.id }}</td>
            <td>{{ survey.name }}</td>
            <td><StatusBadge :status="survey.status" /></td>
            <td>{{ survey.limit }}</td>
            <td>{{ survey.countryId }}</td>
            <td>{{ survey.loi }}</td>
            <td>{{ survey.ir }}%</td>
            <td>{{ survey.statistics?.completed ?? 0 }}</td>
          </tr>
        </tbody>
      </table>

      <h2>Project statistics</h2>
      <EndpointBadge method="GET" path="/samples/{id}/statistics" />
      <StatsGrid v-if="stats.data.value" :stats="stats.data.value" />

      <JsonPreview title="Full project resource (GET /samples/{id})" :value="project.data.value" />
    </template>
  </div>
</template>

<style scoped>
.state-pill {
  font-size: 0.78rem;
  font-weight: 600;
  text-transform: capitalize;
  padding: 0.15rem 0.6rem;
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent);
}
.state-pill.closed, .state-pill.archived { background: var(--warn-bg); color: var(--text-soft); }
.warn-banner {
  background: var(--warn-bg);
  border: 1px solid var(--warn-border);
  border-radius: var(--radius);
  padding: 0.75rem 1rem;
  margin: 0.75rem 0;
  font-size: 0.92rem;
}
</style>
