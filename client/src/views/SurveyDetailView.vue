<script setup>
import { computed, onMounted, ref } from 'vue';
import { api } from '@/api';
import { useAsync } from '@/composables/useAsync';
import { useConstants } from '@/composables/useConstants';
import EndpointBadge from '@/components/EndpointBadge.vue';
import StatusBadge from '@/components/StatusBadge.vue';
import StatsGrid from '@/components/StatsGrid.vue';
import JsonPreview from '@/components/JsonPreview.vue';
import ConfirmDialog from '@/components/ConfirmDialog.vue';
import TestModeDisclaimer from '@/components/TestModeDisclaimer.vue';

/**
 * Survey (subset) detail — lifecycle, quotas, providers, responses,
 * statistics. Each tab is annotated with the endpoints it uses.
 */
const props = defineProps({
  sampleId: { type: String, required: true },
  subsetId: { type: String, required: true },
});
const constants = useConstants();

const TABS = ['Overview', 'Status', 'Quotas', 'Providers', 'Responses', 'Statistics'];
const tab = ref('Overview');

const survey = useAsync(() => api.get(`/samples/${props.sampleId}/subsets/${props.subsetId}`));
const feasibility = useAsync(() => api.get(`/subsets/${props.subsetId}/feasibility`));
onMounted(survey.run);

// Closed is final: the API rejects limit, provider and response-status
// changes on a closed survey, so the UI doesn't offer them.
const isClosed = computed(
  () => survey.data.value?.status === constants.value?.surveyStatus?.CLOSED,
);

/* ---------- Status tab ---------- */
// Transitions allowed FROM the current status, intersected with what a
// client may SET at all ([3 Live, 4 Paused, 6 Closed]).
const statusOptions = computed(() => {
  if (!constants.value || !survey.data.value) return [];
  const fromCurrent = constants.value.surveyStatusTransitions[survey.data.value.status] ?? [];
  return fromCurrent.filter((status) => constants.value.settableSurveyStatuses.includes(status));
});
const pendingStatus = ref(null);
const statusDialog = ref(null);
const changeStatus = useAsync(async () => {
  const result = await api.patch(
    `/samples/${props.sampleId}/subsets/${props.subsetId}/status`,
    { status: pendingStatus.value },
  );
  await survey.run();
  return result;
});
function askStatus(status) {
  pendingStatus.value = status;
  statusDialog.value.open();
}

/* ---------- Quotas tab ---------- */
const quotaGroups = useAsync(() => api.get(`/subsets/${props.subsetId}/global-quota-groups`));
const quotasByGroup = ref({});
async function loadQuotas(groupId) {
  quotasByGroup.value[groupId] = await api.get(`/global-quota-groups/${groupId}/global-quotas`);
}
async function loadAllQuotas() {
  await quotaGroups.run();
  await Promise.all(
    (quotaGroups.data.value?.globalQuotaGroups ?? []).map((group) => loadQuotas(group.id)),
  );
}

/**
 * PATCH …/subsets/{id}/limit — limits are edited PER QUOTA (each quota
 * carries its own limit), but the API requires the FULL structure on every
 * call: all groups with all their quotas (anything omitted is deleted), and
 * within each group the quota limits must sum to the survey limit.
 * The inputs below bind straight to the loaded quota data; Apply sends it.
 */
const newLimit = ref(null);
const groupSum = (groupId) =>
  (quotasByGroup.value[groupId]?.globalQuotas ?? [])
    .reduce((sum, quota) => sum + Number(quota.limit || 0), 0);
const sumsValid = computed(() =>
  (quotaGroups.data.value?.globalQuotaGroups ?? [])
    .every((group) => groupSum(group.id) === Number(newLimit.value)));

const changeLimit = useAsync(async () => {
  const groups = quotaGroups.data.value?.globalQuotaGroups ?? [];
  const result = await api.patch(`/samples/${props.sampleId}/subsets/${props.subsetId}/limit`, {
    limit: Number(newLimit.value),
    globalQuotaGroups: groups.map((group) => ({
      id: group.id,
      globalQuotas: quotasByGroup.value[group.id].globalQuotas.map((quota) => ({
        id: quota.id,
        limit: Number(quota.limit),
      })),
    })),
  });
  // Reload the survey and all quota data so the tab reflects the values the
  // API actually stored.
  await survey.run();
  await loadAllQuotas();
  return result;
});

/* ---------- Providers tab ---------- */
const providerAllocation = useAsync(() => api.get(`/subsets/${props.subsetId}/providers`));

/* ---------- Responses tab ---------- */
const responses = useAsync(() => api.get(`/subsets/${props.subsetId}/responses`));
const reconcileError = ref(null);
async function reconcile(guid, status) {
  // PATCH …/responses/{guid}/status — only [2,3,4,5,11], until Closed.
  reconcileError.value = null;
  try {
    await api.patch(`/subsets/${props.subsetId}/responses/${guid}/status`, { status: Number(status) });
    await responses.run();
  } catch (e) {
    reconcileError.value = e;
  }
}

/* ---------- Statistics tab ---------- */
const stats = useAsync(() => api.get(`/subsets/${props.subsetId}/statistics`));

function openTab(next) {
  tab.value = next;
  if (next === 'Quotas' && !quotaGroups.data.value) {
    newLimit.value ??= survey.data.value?.limit;
    loadAllQuotas();
  }
  if (next === 'Providers' && !providerAllocation.data.value) providerAllocation.run();
  if (next === 'Responses' && !responses.data.value) responses.run();
  if (next === 'Statistics') stats.run();
}
</script>

<template>
  <div class="page">
    <p><RouterLink :to="{ name: 'project-detail', params: { sampleId } }">← Back to project</RouterLink></p>

    <p v-if="survey.loading.value" class="muted">Loading survey…</p>
    <p v-else-if="survey.error.value" class="error-text">{{ survey.error.value.message }}</p>

    <template v-else-if="survey.data.value">
      <div class="spread">
        <h1>Survey #{{ survey.data.value.id }} <span class="muted">(subset)</span></h1>
        <StatusBadge :status="survey.data.value.status" />
      </div>

      <nav class="tabs">
        <button
          v-for="name in TABS"
          :key="name"
          class="secondary"
          :class="{ active: tab === name }"
          @click="openTab(name)"
        >{{ name }}</button>
      </nav>

      <!-- Overview -->
      <div v-if="tab === 'Overview'" class="card">
        <EndpointBadge method="GET" path="/samples/{sampleId}/subsets/{id}" />
        <dl class="props">
          <dt>Limit</dt><dd>{{ survey.data.value.limit }}</dd>
          <dt>Field period</dt><dd>{{ survey.data.value.fieldPeriod }} days</dd>
          <dt>Country</dt><dd>{{ survey.data.value.countryId }}</dd>
          <dt>Language</dt><dd>{{ survey.data.value.languageId }}</dd>
          <dt>LOI</dt><dd>{{ survey.data.value.loi }}</dd>
          <dt>IR</dt><dd>{{ survey.data.value.ir }}%</dd>
          <dt>Live URL</dt><dd>{{ survey.data.value.url }}</dd>
          <dt>Test URL</dt><dd>{{ survey.data.value.testUrl }}</dd>
          <dt>Regions</dt><dd>{{ survey.data.value.regionIds?.join(', ') || 'nationwide' }}</dd>
          <dt>Profiling</dt><dd>{{ survey.data.value.profilingIds?.join(', ') || '—' }}</dd>
        </dl>

        <h3>Feasibility <span class="muted">(pre-launch cost estimate)</span></h3>
        <EndpointBadge method="GET" path="/subsets/{id}/feasibility" />
        <button class="secondary" :disabled="feasibility.loading.value" @click="feasibility.run">
          {{ feasibility.loading.value ? 'Calculating…' : 'Run feasibility check' }}
        </button>
        <p v-if="feasibility.error.value" class="error-text">{{ feasibility.error.value.message }}</p>
        <dl v-if="feasibility.data.value" class="props">
          <dt>Feasible completes</dt><dd>{{ feasibility.data.value.feasible }}</dd>
          <dt>Estimated CPI</dt><dd>{{ feasibility.data.value.estimatedCpi }}</dd>
          <dt>Estimated cost</dt><dd>{{ feasibility.data.value.estimatedCost }}</dd>
        </dl>

        <JsonPreview title="Full survey resource" :value="survey.data.value" />
      </div>

      <!-- Status -->
      <div v-if="tab === 'Status'" class="card">
        <EndpointBadge method="PATCH" path="/samples/{sampleId}/subsets/{id}/status" />
        <p class="muted">
          Lifecycle: Draft → Live → (Paused ⇄ Live) → Stopped/Closed. A client may only set
          <strong>Live (3)</strong>, <strong>Paused (4)</strong> or <strong>Closed (6)</strong>.
          Halted (7) is set automatically on too-low incidence — resume with Live. Closed is final
          and starts invoicing.
        </p>
        <p v-if="!statusOptions.length" class="muted">
          No transitions available from the current status.
        </p>
        <div class="row">
          <button
            v-for="status in statusOptions"
            :key="status"
            :class="{ danger: status === constants?.surveyStatus.LIVE }"
            @click="askStatus(status)"
          >
            Set {{ constants?.surveyStatusLabels[status] }}
          </button>
        </div>
        <p v-if="changeStatus.error.value" class="error-text">{{ changeStatus.error.value.message }}</p>
        <JsonPreview v-if="changeStatus.data.value" title="Response from PATCH …/status" :value="changeStatus.data.value" />

        <ConfirmDialog
          ref="statusDialog"
          :title="`Set survey to ${constants?.surveyStatusLabels[pendingStatus] ?? ''}?`"
          :confirm-label="`Yes, set ${constants?.surveyStatusLabels[pendingStatus] ?? ''}`"
          :danger="pendingStatus === constants?.surveyStatus.LIVE"
          @confirm="changeStatus.run"
        >
          <p v-if="pendingStatus === constants?.surveyStatus.LIVE">
            <strong>This launches real fieldwork on the production platform — panelists will be
            invited and every complete is billable.</strong>
          </p>
          <p v-else-if="pendingStatus === constants?.surveyStatus.CLOSED">
            Closing is final: fieldwork ends, invoicing starts, and response statuses can no longer
            be changed.
          </p>
          <p v-else>Invitations stop while the survey is paused; resume any time with Live.</p>
        </ConfirmDialog>
      </div>

      <!-- Quotas -->
      <div v-if="tab === 'Quotas'" class="card">
        <EndpointBadge method="GET" path="/subsets/{id}/global-quota-groups" />
        <EndpointBadge method="GET" path="/global-quota-groups/{groupId}/global-quotas" />
        <p class="muted">
          Groups combine cumulatively (AND). Limits are edited <strong>per quota</strong> — type
          directly into the Limit column. Rules enforced by the API: every call to
          <code>PATCH …/subsets/{id}/limit</code> must include all groups with all their quotas,
          each group's quota limits must sum to the survey limit, and after launch the floor is
          the completes already achieved.
        </p>

        <p v-if="isClosed" class="muted">
          This survey is <strong>Closed</strong> — limits can no longer be changed (the API rejects
          the request with 409).
        </p>
        <form v-else class="row" @submit.prevent="changeLimit.run">
          <label class="field"><span>Survey limit</span>
            <input v-model="newLimit" type="number" min="1" required style="max-width: 9rem" />
          </label>
          <button :disabled="changeLimit.loading.value || !sumsValid">
            <span style="font-weight: 600">Apply via PATCH …/limit</span>
          </button>
        </form>
        <p v-if="!isClosed && !sumsValid" class="error-text">
          Each group's quota limits must sum to the survey limit ({{ newLimit }}).
        </p>
        <p v-if="changeLimit.error.value" class="error-text">{{ changeLimit.error.value.message }}</p>
        <JsonPreview v-if="changeLimit.data.value" title="Response from PATCH …/limit" :value="changeLimit.data.value" />

        <p v-if="quotaGroups.loading.value" class="muted">Loading…</p>
        <div v-for="group in quotaGroups.data.value?.globalQuotaGroups ?? []" :key="group.id">
          <h3>
            {{ group.name }} <span class="muted">#{{ group.id }}</span>
            <span class="muted" :class="{ 'error-text': groupSum(group.id) !== Number(newLimit) }" style="margin-left: 0.6rem">
              Σ {{ groupSum(group.id) }} / {{ newLimit }}
            </span>
          </h3>
          <table v-if="quotasByGroup[group.id]">
            <thead><tr><th>ID</th><th>Name</th><th>Limit</th><th>Gender</th><th>Age</th><th>Regions</th></tr></thead>
            <tbody>
              <tr v-for="quota in quotasByGroup[group.id].globalQuotas" :key="quota.id">
                <td>{{ quota.id }}</td>
                <td>{{ quota.name }}</td>
                <td>
                  <input
                    v-model="quota.limit"
                    type="number"
                    min="1"
                    :disabled="isClosed"
                    style="max-width: 6rem"
                  />
                </td>
                <td>{{ quota.gender != null ? constants?.genderLabels[quota.gender] : '—' }}</td>
                <td>{{ quota.ageFrom ?? '—' }}–{{ quota.ageTo ?? '—' }}</td>
                <td>{{ quota.regionIds?.join(', ') || '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Providers -->
      <div v-if="tab === 'Providers'" class="card">
        <EndpointBadge method="GET" path="/subsets/{id}/providers" />
        <TestModeDisclaimer>
          for test accounts the allocation may differ from what was submitted — non-test providers
          are skipped on creation and replaced with the test provider's defaults.
        </TestModeDisclaimer>
        <p v-if="providerAllocation.loading.value" class="muted">Loading…</p>
        <p v-else-if="providerAllocation.error.value" class="error-text">{{ providerAllocation.error.value.message }}</p>
        <!-- Note the upstream collection key: `subsetProviders` -->
        <table v-else-if="providerAllocation.data.value">
          <thead><tr><th>Provider</th><th>Percentage</th><th>Panels</th></tr></thead>
          <tbody>
            <tr v-for="alloc in providerAllocation.data.value.subsetProviders" :key="alloc.id ?? alloc.provider">
              <td>{{ alloc.provider }}</td>
              <td>{{ alloc.percentage }}%</td>
              <td>{{ alloc.panelIds?.join(', ') || '—' }}</td>
            </tr>
          </tbody>
        </table>
        <JsonPreview v-if="providerAllocation.data.value" title="Raw response" :value="providerAllocation.data.value" />
      </div>

      <!-- Responses -->
      <div v-if="tab === 'Responses'" class="card">
        <EndpointBadge method="GET" path="/subsets/{id}/responses" />
        <EndpointBadge method="PATCH" path="/subsets/{id}/responses/{guid}/status" />
        <p class="muted">
          One row per respondent attempt, keyed by GUID (the value substituted for
          <code>[ID]</code> in your survey URL). Reconcile by changing statuses — allowed until the
          survey is Closed.
        </p>
        <p v-if="responses.loading.value" class="muted">Loading…</p>
        <p v-else-if="responses.error.value" class="error-text">
          {{ responses.error.value.message }}
          <span class="muted">(the API currently answers 500 for surveys that were never launched)</span>
        </p>
        <p v-else-if="!responses.data.value?.responses?.length" class="muted">
          No responses yet — they appear once the survey is Live and panelists enter.
        </p>
        <table v-else>
          <thead><tr><th>GUID</th><th>Status</th><th>Provider</th><th>Created</th><th>Set status…</th></tr></thead>
          <tbody>
            <tr v-for="response in responses.data.value.responses" :key="response.guid">
              <td style="font-family: var(--mono); font-size: 0.8rem">{{ response.guid }}</td>
              <td><StatusBadge :status="response.status" kind="response" /></td>
              <td>{{ response.provider }}</td>
              <td>{{ response.created }}</td>
              <td>
                <select :disabled="isClosed" @change="reconcile(response.guid, $event.target.value)">
                  <option value="" disabled selected>{{ isClosed ? 'survey closed' : 'change…' }}</option>
                  <option v-for="status in constants?.settableResponseStatuses ?? []" :key="status" :value="status">
                    {{ constants?.responseStatusLabels[status] }}
                  </option>
                </select>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-if="reconcileError" class="error-text">{{ reconcileError.message }}</p>
      </div>

      <!-- Statistics -->
      <div v-if="tab === 'Statistics'" class="card">
        <div class="spread">
          <EndpointBadge method="GET" path="/subsets/{id}/statistics" />
          <button class="secondary" :disabled="stats.loading.value" @click="stats.run">Refresh</button>
        </div>
        <p v-if="stats.error.value" class="error-text">{{ stats.error.value.message }}</p>
        <StatsGrid v-if="stats.data.value" :stats="stats.data.value" />
      </div>
    </template>
  </div>
</template>

<style scoped>
.tabs { display: flex; gap: 0.4rem; flex-wrap: wrap; margin: 1rem 0; }
.tabs button.active { background: var(--accent); color: #fff; }
</style>
