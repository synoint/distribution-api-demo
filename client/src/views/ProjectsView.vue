<script setup>
import { onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '@/api';
import { useAsync } from '@/composables/useAsync';
import EndpointBadge from '@/components/EndpointBadge.vue';
import JsonPreview from '@/components/JsonPreview.vue';

/**
 * Projects — upstream term: "sample".
 * A project is the cost-control container: its limit caps completes across
 * ALL surveys under it combined.
 */
const router = useRouter();

const projects = useAsync(() => api.get('/samples'));
onMounted(projects.run);

const form = reactive({ name: '', limit: 10 });
const created = ref(null);
const create = useAsync(async () => {
  // POST /samples — both fields required; returns 201 with the new sample.
  const sample = await api.post('/samples', { name: form.name, limit: Number(form.limit) });
  created.value = sample;
  form.name = '';
  await projects.run();
  return sample;
});
</script>

<template>
  <div class="page">
    <h1>Projects <span class="muted">(samples)</span></h1>
    <p class="page-intro">
      A project is the top-level container of the Distribution API. Its <code>limit</code> is a
      hard cap on completed interviews across all of its surveys combined — the primary way to
      control costs.
    </p>
    <EndpointBadge method="GET" path="/samples" />
    <EndpointBadge method="POST" path="/samples" />

    <div class="card">
      <h2 style="margin-top: 0">Create a project</h2>
      <form class="row" @submit.prevent="create.run">
        <label class="field">
          <span>Name</span>
          <input v-model="form.name" required maxlength="255" placeholder="e.g. DEMO-CLIENT-TEST" />
        </label>
        <label class="field">
          <span>Limit (total completes)</span>
          <input v-model="form.limit" type="number" min="1" required style="max-width: 9rem" />
        </label>
        <button :disabled="create.loading.value">Create project</button>
      </form>
      <p v-if="create.error.value" class="error-text">
        {{ create.error.value.message }}
      </p>
      <JsonPreview v-if="created" title="Response from POST /samples (201 Created)" :value="created" open />
    </div>

    <p v-if="projects.loading.value" class="muted">Loading projects…</p>
    <p v-else-if="projects.error.value" class="error-text">{{ projects.error.value.message }}</p>
    <table v-else-if="projects.data.value">
      <thead>
        <tr><th>ID</th><th>Name</th><th>Limit</th><th>Completed</th><th>Current cost</th><th>Created</th></tr>
      </thead>
      <tbody>
        <tr
          v-for="project in projects.data.value.samples"
          :key="project.id"
          class="clickable"
          @click="router.push({ name: 'project-detail', params: { sampleId: project.id } })"
        >
          <td>{{ project.id }}</td>
          <td>{{ project.name }}</td>
          <td>{{ project.limit }}</td>
          <td>{{ project.statistics?.completed ?? 0 }}</td>
          <td>{{ project.statistics?.currentCost || '—' }}</td>
          <td>{{ project.createdAt }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
