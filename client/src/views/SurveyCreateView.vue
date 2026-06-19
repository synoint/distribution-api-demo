<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '@/api';
import { useAsync } from '@/composables/useAsync';
import { useConstants } from '@/composables/useConstants';
import EndpointBadge from '@/components/EndpointBadge.vue';
import JsonPreview from '@/components/JsonPreview.vue';
import TestModeDisclaimer from '@/components/TestModeDisclaimer.vue';

/**
 * Survey (subset) creation — the heart of the Distribution API workflow.
 * Builds the POST /samples/{sampleId}/subsets payload step by step, showing
 * which reference endpoints feed each field, then submits and offers a
 * feasibility check (pre-launch cost estimate).
 */
const props = defineProps({ sampleId: { type: String, required: true } });
const router = useRouter();
const constants = useConstants();

const step = ref(1);
const STEPS = ['Basics', 'Targeting', 'Quotas', 'Providers', 'Review & create'];

/* ---------- Step 1: Basics ---------- */
const basics = reactive({
  limit: 10,
  fieldPeriod: 5,
  loi: 10,
  ir: 90,
  url: 'https://your-survey.example.com/start?respondent=[ID]',
  testUrl: 'https://your-survey.example.com/test?respondent=[ID]',
});

// The API replaces the literal [ID] placeholder with the response GUID —
// without it you cannot identify respondents for reconciliation.
const urlsValid = computed(() => basics.url.includes('[ID]') && basics.testUrl.includes('[ID]'));

/* ---------- Step 2: Targeting ---------- */
const countries = useAsync(() => api.get('/reference/countries'));
const languages = useAsync(() => api.get('/reference/languages'));
onMounted(() => { countries.run(); languages.run(); });

const targeting = reactive({
  countryId: null,
  languageId: null,
  gender: 0,
  minAge: 18,
  maxAge: 65,
  regionIds: [],
  profilingIds: [],
});

// Country detail (GET /reference/countries/{id}) provides region types →
// regions; profiling questions are per-country too.
const countryDetail = useAsync(() => api.get(`/reference/countries/${targeting.countryId}`));
const questions = useAsync(() => api.get(`/reference/questions?countryId=${targeting.countryId}`));
watch(() => targeting.countryId, (id) => {
  targeting.regionIds = [];
  targeting.profilingIds = [];
  if (id) { countryDetail.run(); questions.run(); }
});

// Profiling catalogs are large, so answers are picked in a modal; the page
// itself only shows the current selection.
const profilingDialog = ref(null);
const selectedProfilingLabels = computed(() => {
  const labelsById = {};
  for (const question of questions.data.value?.profilingQuestions ?? []) {
    for (const answer of question.answers) labelsById[answer.id] = answer.label;
  }
  return targeting.profilingIds.map((id) => labelsById[id]).filter(Boolean);
});

/* ---------- Step 3: Quotas ---------- */
const quotaMode = ref('automatic');
// Custom mode: the API's documented constraints apply (one group per
// targeting dimension across groups; no overlaps within a group) — the API
// answers 422 with details if violated.
const customGroups = ref([]);

function redistributeGroup(group) {
  const count = group.globalQuotas.length;
  if (count === 0) return;
  const total = Number(basics.limit);
  const base = Math.floor(total / count);
  const remainder = total - base * count;
  group.globalQuotas.forEach((q, i) => {
    q.limit = i === 0 ? base + remainder : base;
  });
}

function groupSum(group) {
  return group.globalQuotas.reduce((s, q) => s + Number(q.limit || 0), 0);
}

const quotasValid = computed(() => {
  if (quotaMode.value !== 'custom') return true;
  const total = Number(basics.limit);
  return customGroups.value.every(
    (g) => g.globalQuotas.length > 0 && groupSum(g) === total && g.globalQuotas.every((q) => Number(q.limit) >= 1),
  );
});

watch(() => basics.limit, () => {
  customGroups.value.forEach(redistributeGroup);
});

function addGroup() {
  customGroups.value.push({ name: `Group ${customGroups.value.length + 1}`, globalQuotas: [] });
}
function removeGroup(index) {
  customGroups.value.splice(index, 1);
}
function addQuota(group) {
  group.globalQuotas.push({ name: '', limit: 1, gender: null, ageFrom: null, ageTo: null, regionIds: [] });
  redistributeGroup(group);
}
function removeQuota(group, index) {
  group.globalQuotas.splice(index, 1);
  redistributeGroup(group);
}
function cleanQuota(quota) {
  const out = { name: quota.name, limit: Number(quota.limit) };
  if (quota.gender !== null && quota.gender !== '') out.gender = Number(quota.gender);
  if (quota.ageFrom) out.ageFrom = Number(quota.ageFrom);
  if (quota.ageTo) out.ageTo = Number(quota.ageTo);
  if (quota.regionIds?.length) out.regionIds = quota.regionIds.map(Number);
  return out;
}

/* ---------- Step 4: Providers ---------- */
const providerList = useAsync(() => api.get('/reference/providers'));
const panels = useAsync(() => api.get(`/reference/panels?country=${targeting.countryId}`));
onMounted(providerList.run);
const providerRows = ref([{ provider: null, percentage: 100, panelIds: [] }]);
const availableProviders = computed(() => providerList.data.value?.providers ?? []);
// One row per supply source at most — with a single available provider
// (e.g. test accounts) there is nothing to split, so no extra rows.
const canAddProviderRow = computed(() => providerRows.value.length < availableProviders.value.length);
function addProviderRow() {
  providerRows.value.push({ provider: null, percentage: 0, panelIds: [] });
}
function removeProviderRow(index) {
  providerRows.value.splice(index, 1);
}
const percentageTotal = computed(() =>
  providerRows.value.reduce((sum, row) => sum + Number(row.percentage || 0), 0));

watch(step, (next) => { if (next === 4 && targeting.countryId) panels.run(); });

/* ---------- Step 5: Review & create ---------- */
const payload = computed(() => ({
  limit: Number(basics.limit),
  fieldPeriod: Number(basics.fieldPeriod),
  loi: Number(basics.loi),
  ir: Number(basics.ir),
  url: basics.url,
  testUrl: basics.testUrl,
  countryId: Number(targeting.countryId),
  languageId: Number(targeting.languageId),
  gender: Number(targeting.gender),
  minAge: targeting.minAge === '' ? null : Number(targeting.minAge),
  maxAge: targeting.maxAge === '' ? null : Number(targeting.maxAge),
  regionIds: targeting.regionIds.map(Number),
  profilingIds: targeting.profilingIds.map(Number),
  // [] means AUTOMATIC quotas: the API builds one group per targeting
  // dimension (gender, age, regions, profiling) — cumulative AND.
  globalQuotaGroups: quotaMode.value === 'automatic'
    ? []
    : customGroups.value.map((group) => ({
        name: group.name,
        globalQuotas: group.globalQuotas.map(cleanQuota),
      })),
  providers: providerRows.value
    .filter((row) => row.provider)
    .map((row) => ({
      provider: Number(row.provider),
      percentage: Number(row.percentage),
      ...(row.panelIds.length ? { panelIds: row.panelIds.map(Number) } : {}),
    })),
}));

const create = useAsync(() => api.post(`/samples/${props.sampleId}/subsets`, payload.value));
const feasibility = useAsync(() => api.get(`/subsets/${create.data.value.id}/feasibility`));

async function submit() {
  await create.run();
}
</script>

<template>
  <div class="page">
    <p><RouterLink :to="{ name: 'project-detail', params: { sampleId } }">← Back to project</RouterLink></p>
    <h1>New survey <span class="muted">(subset)</span></h1>
    <EndpointBadge method="POST" path="/samples/{sampleId}/subsets" />

    <ol class="steps">
      <li v-for="(label, i) in STEPS" :key="label" :class="{ active: step === i + 1, done: step > i + 1 }">
        {{ label }}
      </li>
    </ol>

    <!-- Step 1: Basics -->
    <div v-show="step === 1" class="card">
      <h2 style="margin-top: 0">Survey basics</h2>
      <div class="form-grid">
        <label class="field"><span>Limit (completes wanted)</span>
          <input v-model="basics.limit" type="number" min="1" />
          <span class="hint">Capped by the project limit. Never 0.</span>
        </label>
        <label class="field"><span>Field period (days)</span>
          <input v-model="basics.fieldPeriod" type="number" min="1" />
        </label>
        <label class="field"><span>LOI (minutes)</span>
          <input v-model="basics.loi" type="number" min="1" />
          <span class="hint">Longer interviews raise CPI.</span>
        </label>
        <label class="field"><span>Incidence rate (%)</span>
          <input v-model="basics.ir" type="number" min="1" max="100" />
          <span class="hint">Higher IR lowers CPI.</span>
        </label>
      </div>
      <label class="field"><span>Live survey URL</span>
        <input v-model="basics.url" maxlength="255" />
        <span class="hint">
          Must contain the literal <code>[ID]</code> placeholder — the API replaces it with the
          respondent's GUID (capture it: it's needed for reconciliation).
        </span>
      </label>
      <label class="field"><span>Test survey URL</span>
        <input v-model="basics.testUrl" maxlength="255" />
      </label>
      <p v-if="!urlsValid" class="error-text">Both URLs must contain the [ID] placeholder.</p>
      <button :disabled="!urlsValid" @click="step = 2">Next: Targeting</button>
    </div>

    <!-- Step 2: Targeting -->
    <div v-show="step === 2" class="card">
      <h2 style="margin-top: 0">Targeting</h2>
      <EndpointBadge method="GET" path="/reference/countries" />
      <EndpointBadge method="GET" path="/reference/countries/{id}" />
      <EndpointBadge method="GET" path="/reference/questions?countryId=…" />
      <div class="form-grid">
        <label class="field"><span>Country</span>
          <select v-model="targeting.countryId">
            <option v-for="country in countries.data.value?.countries ?? []" :key="country.id" :value="country.id">
              {{ country.name }}
            </option>
          </select>
        </label>
        <label class="field"><span>Language</span>
          <select v-model="targeting.languageId">
            <option v-for="lang in languages.data.value?.languages ?? []" :key="lang.id" :value="lang.id">
              {{ lang.name }} ({{ lang.isoCode }})
            </option>
          </select>
        </label>
        <label class="field"><span>Gender</span>
          <select v-model="targeting.gender">
            <option v-for="(label, value) in constants?.genderLabels ?? {}" :key="value" :value="Number(value)">
              {{ label }}
            </option>
          </select>
        </label>
        <label class="field"><span>Age range (min – max)</span>
          <span class="pair">
            <input v-model="targeting.minAge" type="number" min="16" />
            <input v-model="targeting.maxAge" type="number" max="120" />
          </span>
        </label>
      </div>

      <template v-if="targeting.countryId && countryDetail.data.value">
        <h3>Regions <span class="muted">(leave empty for nationwide)</span></h3>
        <div v-for="regionType in countryDetail.data.value.regionTypes ?? []" :key="regionType.id">
          <p class="muted" style="margin-bottom: 0.2rem">{{ regionType.name }}</p>
          <div class="chips">
            <label v-for="region in regionType.regions" :key="region.id" class="chip">
              <input v-model="targeting.regionIds" type="checkbox" :value="region.id" />
              {{ region.name }}
            </label>
          </div>
        </div>

        <h3>Profiling <span class="muted">(optional — answer ids become <code>profilingIds</code>)</span></h3>
        <button class="secondary" type="button" @click="profilingDialog.showModal()">
          Choose profiling answers… ({{ targeting.profilingIds.length }} selected)
        </button>
        <p v-if="selectedProfilingLabels.length" class="muted" style="margin-top: 0.5rem">
          Selected:
          <code v-for="label in selectedProfilingLabels" :key="label" style="margin: 0 0.25rem 0.25rem 0; display: inline-block">{{ label }}</code>
        </p>

        <dialog ref="profilingDialog" class="picker-modal">
          <h3 style="margin-top: 0">Profiling questions</h3>
          <div class="picker-body">
            <!-- Collection key is `profilingQuestions`; answers carry `label`. -->
            <div v-for="question in questions.data.value?.profilingQuestions ?? []" :key="question.id">
              <p class="muted" style="margin-bottom: 0.2rem">{{ question.label }}</p>
              <div class="chips">
                <label v-for="answer in question.answers" :key="answer.id" class="chip">
                  <input v-model="targeting.profilingIds" type="checkbox" :value="answer.id" />
                  {{ answer.label }}
                </label>
              </div>
            </div>
          </div>
          <div class="picker-actions">
            <span class="muted">{{ targeting.profilingIds.length }} selected</span>
            <button type="button" @click="profilingDialog.close()">Done</button>
          </div>
        </dialog>
      </template>

      <div class="row" style="margin-top: 1rem">
        <button class="secondary" @click="step = 1">Back</button>
        <button :disabled="!targeting.countryId || !targeting.languageId" @click="step = 3">Next: Quotas</button>
      </div>
    </div>

    <!-- Step 3: Quotas -->
    <div v-show="step === 3" class="card">
      <h2 style="margin-top: 0">Quotas</h2>
      <label class="field">
        <span><input v-model="quotaMode" type="radio" value="automatic" style="width:auto" /> Automatic (recommended)</span>
        <span class="hint">
          Send <code>globalQuotaGroups: []</code> — the API creates one quota group per targeting
          dimension (gender, age, regions, profiling). Groups combine cumulatively (AND).
        </span>
      </label>
      <label class="field">
        <span><input v-model="quotaMode" type="radio" value="custom" style="width:auto" /> Custom</span>
        <span class="hint">
          Define groups yourself. Constraints: across groups only one may target regions, one
          gender, one age; within a group quotas must not overlap (gender or age range) and must
          share the same targeting properties. Violations return 422 with details.
        </span>
      </label>

      <template v-if="quotaMode === 'custom'">
        <fieldset v-for="(group, gi) in customGroups" :key="gi">
          <legend class="group-legend">
            <input v-model="group.name" placeholder="Group name" style="max-width: 16rem" />
            <span
              v-if="group.globalQuotas.length > 0"
              class="quota-sum-badge"
              :class="groupSum(group) === Number(basics.limit) ? 'sum-ok' : groupSum(group) > Number(basics.limit) ? 'sum-over' : 'sum-under'"
            >{{ groupSum(group) }} / {{ basics.limit }}</span>
          </legend>
          <p v-if="group.globalQuotas.length > 0 && groupSum(group) !== Number(basics.limit)" class="error-text" style="margin: 0 0 0.5rem">
            Limits must sum to {{ basics.limit }} (currently {{ groupSum(group) }})
          </p>
          <div v-for="(quota, qi) in group.globalQuotas" :key="qi" class="quota-item">
            <div class="form-grid quota-grid">
              <label class="field"><span>Name</span><input v-model="quota.name" /></label>
              <label class="field"><span>Limit</span><input v-model="quota.limit" type="number" min="1" /></label>
              <label class="field"><span>Gender</span>
                <select v-model="quota.gender">
                  <option :value="null">—</option>
                  <option v-for="(label, value) in constants?.genderLabels ?? {}" :key="value" :value="Number(value)">{{ label }}</option>
                </select>
              </label>
              <label class="field"><span>Age from</span><input v-model="quota.ageFrom" type="number" /></label>
              <label class="field"><span>Age to</span><input v-model="quota.ageTo" type="number" /></label>
              <label class="field"><span>&nbsp;</span>
                <button class="secondary" type="button" @click="removeQuota(group, qi)">Remove quota</button>
              </label>
            </div>
            <div class="quota-regions">
              <p class="muted" style="margin-bottom: 0.2rem">
                Regions <span v-if="quota.regionIds.length">({{ quota.regionIds.length }} selected)</span><span v-else>(optional)</span>
              </p>
              <div v-for="regionType in countryDetail.data.value?.regionTypes ?? []" :key="regionType.id">
                <p class="muted" style="margin: 0.3rem 0 0.2rem; font-size: 0.78rem">{{ regionType.name }}</p>
                <div class="chips">
                  <label v-for="region in regionType.regions" :key="region.id" class="chip">
                    <input v-model="quota.regionIds" type="checkbox" :value="region.id" />
                    {{ region.name }}
                  </label>
                </div>
              </div>
            </div>
          </div>
          <div class="row" style="margin-top: 0.25rem">
            <button class="secondary" type="button" @click="addQuota(group)">+ quota</button>
            <button class="secondary" type="button" @click="removeGroup(gi)">Remove group</button>
          </div>
        </fieldset>
        <button class="secondary" type="button" @click="addGroup">+ quota group</button>
      </template>

      <div class="row" style="margin-top: 1rem">
        <button class="secondary" @click="step = 2">Back</button>
        <button :disabled="!quotasValid" @click="step = 4">Next: Providers</button>
      </div>
    </div>

    <!-- Step 4: Providers -->
    <div v-show="step === 4" class="card">
      <h2 style="margin-top: 0">Providers</h2>
      <EndpointBadge method="GET" path="/reference/providers" />
      <EndpointBadge method="GET" path="/reference/panels?country=…" />
      <p class="muted">
        Allocate the survey limit across supply sources. Percentages must total 100. Panels
        (optional) narrow fieldwork to dedicated panelist pools.
      </p>
      <TestModeDisclaimer>
        for test accounts only the test provider is available — other providers in the payload are
        silently skipped on creation (and defaults are assigned if none remain).
      </TestModeDisclaimer>
      <div v-for="(row, i) in providerRows" :key="i" class="form-grid">
        <label class="field"><span>Provider</span>
          <select v-model="row.provider">
            <option v-for="provider in providerList.data.value?.providers ?? []" :key="provider.id" :value="provider.id">
              {{ provider.name }} (id {{ provider.id }})
            </option>
          </select>
        </label>
        <label class="field"><span>Percentage</span>
          <input v-model="row.percentage" type="number" min="1" max="100" />
        </label>
        <label class="field"><span>Panels (optional)</span>
          <select v-model="row.panelIds" multiple>
            <option v-for="panel in panels.data.value?.panels ?? []" :key="panel.id" :value="panel.id">
              {{ panel.name }}
            </option>
          </select>
        </label>
        <label v-if="providerRows.length > 1" class="field"><span>&nbsp;</span>
          <button class="secondary" type="button" @click="removeProviderRow(i)">Remove</button>
        </label>
      </div>
      <button v-if="canAddProviderRow" class="secondary" @click="addProviderRow">+ provider</button>
      <p v-else-if="availableProviders.length === 1" class="muted">
        Only one provider is available for this account — the whole survey limit goes to it.
      </p>
      <p :class="percentageTotal === 100 ? 'muted' : 'error-text'">Total: {{ percentageTotal }}% (must be 100%)</p>
      <div class="row">
        <button class="secondary" @click="step = 3">Back</button>
        <button :disabled="percentageTotal !== 100" @click="step = 5">Next: Review</button>
      </div>
    </div>

    <!-- Step 5: Review & create -->
    <div v-show="step === 5" class="card">
      <h2 style="margin-top: 0">Review &amp; create</h2>
      <p class="muted">This exact JSON will be POSTed to <code>/samples/{{ sampleId }}/subsets</code>:</p>
      <JsonPreview title="Request payload" :value="payload" open />
      <p v-if="create.error.value" class="error-text">
        {{ create.error.value.message }}
        <JsonPreview v-if="create.error.value.problem" title="Error response (422?)" :value="create.error.value.problem" open />
      </p>
      <template v-if="create.data.value">
        <p>✅ Survey created — id <strong>{{ create.data.value.id }}</strong>, status Draft. It will not field until you set it Live.</p>
        <JsonPreview title="Response (201 Created)" :value="create.data.value" />
        <div class="row">
          <button class="secondary" :disabled="feasibility.loading.value" @click="feasibility.run">
            Check feasibility now
          </button>
          <p v-if="feasibility.error.value" class="error-text">{{ feasibility.error.value.message }}</p>
          <button @click="router.push({ name: 'survey-detail', params: { sampleId, subsetId: create.data.value.id } })">
            Open survey
          </button>
        </div>
        <template v-if="feasibility.data.value">
          <EndpointBadge method="GET" path="/subsets/{id}/feasibility" />
          <dl class="props">
            <dt>Feasible completes</dt><dd>{{ feasibility.data.value.feasible }}</dd>
            <dt>Estimated CPI</dt><dd>{{ feasibility.data.value.estimatedCpi }}</dd>
            <dt>Estimated cost</dt><dd>{{ feasibility.data.value.estimatedCost }}</dd>
          </dl>
        </template>
      </template>
      <div v-else class="row">
        <button class="secondary" @click="step = 4">Back</button>
        <button :disabled="create.loading.value" @click="submit">Create survey (Draft)</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.steps {
  display: flex;
  gap: 0.4rem;
  list-style: none;
  padding: 0;
  flex-wrap: wrap;
}
.steps li {
  padding: 0.25rem 0.8rem;
  border-radius: 999px;
  background: var(--surface);
  border: 1px solid var(--border);
  font-size: 0.82rem;
  color: var(--text-soft);
}
.steps li.active { background: var(--accent); border-color: var(--accent); color: #fff; font-weight: 600; }
.steps li.done { background: var(--ok-soft); color: var(--ok); border-color: var(--ok-soft); }

/* Aligned form layout: equal-width columns, fields anchored to the top of
   their row so varying hint lengths don't push neighbours around. */
.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(13rem, 1fr));
  column-gap: 1.25rem;
  align-items: start;
}
.form-grid input,
.form-grid select {
  width: 100%;
  max-width: none;
}
.quota-grid { grid-template-columns: repeat(auto-fill, minmax(8.5rem, 1fr)); }
.quota-item {
  border-top: 1px solid var(--border);
  padding-top: 0.6rem;
  margin-top: 0.6rem;
}
.quota-item:first-of-type { border-top: none; margin-top: 0; }
.quota-regions { margin: 0.25rem 0 0.75rem; }
.pair { display: flex; gap: 0.5rem; }

.picker-modal {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 1.25rem 1.5rem;
  width: min(44rem, 92vw);
  box-shadow: 0 12px 40px rgb(0 0 0 / 0.18);
}
.picker-modal::backdrop { background: rgb(15 20 30 / 0.45); }
.picker-body { max-height: 60vh; overflow: auto; padding-right: 0.5rem; }
.picker-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.6rem;
  margin-top: 1rem;
}

.group-legend { display: flex; align-items: center; gap: 0.6rem; }
.quota-sum-badge {
  display: inline-block;
  font-size: 0.78rem;
  font-weight: 600;
  padding: 0.1rem 0.4rem;
  border-radius: 3px;
  border: 1px solid;
  white-space: nowrap;
}
.sum-ok    { background: var(--ok-soft);   color: var(--ok);   border-color: var(--ok-soft); }
.sum-under { background: var(--warn-soft, #fff8e1); color: var(--warn, #b45309); border-color: currentColor; }
.sum-over  { background: var(--error-soft, #fef2f2); color: var(--error, #b91c1c); border-color: currentColor; }

.chips { display: flex; flex-wrap: wrap; gap: 0.35rem; margin-bottom: 0.6rem; }
.chip {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface);
  padding: 0.15rem 0.7rem;
  font-size: 0.82rem;
  cursor: pointer;
}
.chip input { width: auto; }
.chip:has(input:checked) { background: var(--accent-soft); border-color: var(--accent); }
</style>
