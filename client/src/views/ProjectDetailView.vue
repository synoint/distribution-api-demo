<script setup>
import { onMounted, reactive, computed } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '@/api';
import { useAsync } from '@/composables/useAsync';
import EndpointBadge from '@/components/EndpointBadge.vue';
import StatusBadge from '@/components/StatusBadge.vue';
import StatsGrid from '@/components/StatsGrid.vue';
import JsonPreview from '@/components/JsonPreview.vue';

const props = defineProps({ sampleId: { type: String, required: true } });
const router = useRouter();

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
        <button @click="router.push({ name: 'survey-create', params: { sampleId } })">New survey</button>
      </div>
      <EndpointBadge method="GET" path="/samples/{id}/subsets" />
      <p v-if="surveyList.loading.value" class="muted">Loading surveys…</p>
      <p v-else-if="surveyList.error.value" class="error-text">{{ surveyList.error.value.message }}</p>
      <p v-else-if="!surveys.length" class="muted">No surveys yet — create one to define targeting, quotas and providers.</p>
      <table v-else>
        <thead>
          <tr><th>ID</th><th>Status</th><th>Limit</th><th>Country</th><th>LOI</th><th>IR</th><th>Completed</th></tr>
        </thead>
        <tbody>
          <tr
            v-for="survey in surveys"
            :key="survey.id"
            class="clickable"
            @click="router.push({ name: 'survey-detail', params: { sampleId, subsetId: survey.id } })"
          >
            <td>{{ survey.id }}</td>
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
