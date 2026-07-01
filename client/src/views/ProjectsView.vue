<script setup>
import { onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '@/api';
import { useAsync } from '@/composables/useAsync';
import EndpointBadge from '@/components/EndpointBadge.vue';
import JsonPreview from '@/components/JsonPreview.vue';

/**
 * Projects — upstream term: "sample".
 * Three tabs, each backed by its own endpoint:
 *   GET /samples         — all projects (general list, not paginated)
 *   GET /samples/closed  — paginated (15/page), meta envelope
 *   GET /samples/archived — paginated (15/page), stats from snapshots
 */
const router = useRouter();

const activeTab = ref('all');
const closedPage = ref(1);
const archivedPage = ref(1);

const allSamples = useAsync(() => api.get('/samples'));
const closedSamples = useAsync(() => api.get(`/samples/closed?page=${closedPage.value}`));
const archivedSamples = useAsync(() => api.get(`/samples/archived?page=${archivedPage.value}`));

// Track first-fetch per tab so switching back doesn't re-fetch.
const fetched = reactive({ all: false, closed: false, archived: false });

onMounted(async () => {
  await allSamples.run();
  fetched.all = true;
});

async function selectTab(tab) {
  if (activeTab.value === tab) return;
  activeTab.value = tab;
  if (!fetched[tab]) {
    if (tab === 'closed') await closedSamples.run();
    if (tab === 'archived') await archivedSamples.run();
    fetched[tab] = true;
  }
}

async function goPage(tab, delta) {
  if (tab === 'closed') {
    const next = closedPage.value + delta;
    if (next < 1 || (closedSamples.data.value?.meta && next > closedSamples.data.value.meta.pages)) return;
    closedPage.value = next;
    try { await closedSamples.run(); } catch (e) { closedPage.value -= delta; throw e; }
  } else {
    const next = archivedPage.value + delta;
    if (next < 1 || (archivedSamples.data.value?.meta && next > archivedSamples.data.value.meta.pages)) return;
    archivedPage.value = next;
    try { await archivedSamples.run(); } catch (e) { archivedPage.value -= delta; throw e; }
  }
}

function goToProject(projectId) {
  router.push({
    name: 'project-detail',
    params: { sampleId: projectId },
    query: { source: activeTab.value },
  });
}

const form = reactive({ name: '', limit: 10 });
const created = ref(null);
const create = useAsync(async () => {
  const sample = await api.post('/samples', { name: form.name, limit: Number(form.limit) });
  created.value = sample;
  form.name = '';
  await allSamples.run();
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

    <div class="card">
      <h2 style="margin-top: 0">Create a project</h2>
      <EndpointBadge method="POST" path="/samples" />
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
      <p v-if="create.error.value" class="error-text">{{ create.error.value.message }}</p>
      <JsonPreview v-if="created" title="Response from POST /samples (201 Created)" :value="created" open />
    </div>

    <div class="tabs">
      <button :class="{ active: activeTab === 'all' }" @click="selectTab('all')">Active</button>
      <button :class="{ active: activeTab === 'closed' }" @click="selectTab('closed')">Closed</button>
      <button :class="{ active: activeTab === 'archived' }" @click="selectTab('archived')">Archived</button>
    </div>

    <!-- All tab -->
    <template v-if="activeTab === 'all'">
      <EndpointBadge method="GET" path="/samples" />
      <p class="muted">Active projects.</p>
      <p v-if="allSamples.loading.value" class="muted">Loading…</p>
      <p v-else-if="allSamples.error.value" class="error-text">{{ allSamples.error.value.message }}</p>
      <p v-else-if="!allSamples.data.value?.samples?.length" class="muted">No projects yet.</p>
      <table v-else>
        <thead>
          <tr><th>ID</th><th>Name</th><th>Limit</th><th>Completed</th><th>Current cost</th><th>Created</th></tr>
        </thead>
        <tbody>
          <tr
            v-for="p in allSamples.data.value.samples"
            :key="p.id"
            class="clickable"
            @click="goToProject(p.id)"
          >
            <td>{{ p.id }}</td>
            <td>{{ p.name }}</td>
            <td>{{ p.limit }}</td>
            <td>{{ p.statistics?.completed ?? 0 }}</td>
            <td>{{ p.statistics?.currentCost || '—' }}</td>
            <td>{{ p.createdAt }}</td>
          </tr>
        </tbody>
      </table>
    </template>

    <!-- Closed tab -->
    <template v-else-if="activeTab === 'closed'">
      <EndpointBadge method="GET" path="/samples/closed" />
      <p class="muted">Closed projects.</p>
      <p v-if="closedSamples.loading.value" class="muted">Loading…</p>
      <p v-else-if="closedSamples.error.value" class="error-text">{{ closedSamples.error.value.message }}</p>
      <p v-else-if="!closedSamples.data.value?.samples?.length" class="muted">No closed projects.</p>
      <template v-else>
        <table>
          <thead>
            <tr><th>ID</th><th>Name</th><th>Limit</th><th>Completed</th><th>Current cost</th><th>Created</th><th>Closed at</th></tr>
          </thead>
          <tbody>
            <tr
              v-for="p in closedSamples.data.value.samples"
              :key="p.id"
              class="clickable"
              @click="goToProject(p.id)"
            >
              <td>{{ p.id }}</td>
              <td>{{ p.name }}</td>
              <td>{{ p.limit }}</td>
              <td>{{ p.statistics?.completed ?? 0 }}</td>
              <td>{{ p.statistics?.currentCost || '—' }}</td>
              <td>{{ p.createdAt }}</td>
              <td>{{ p.closedAt }}</td>
            </tr>
          </tbody>
        </table>
        <div v-if="closedSamples.data.value.meta?.pages > 1" class="pagination">
          <button class="secondary" :disabled="closedPage === 1" @click="goPage('closed', -1)">← Prev</button>
          <span class="muted">Page {{ closedSamples.data.value.meta.page }} of {{ closedSamples.data.value.meta.pages }} ({{ closedSamples.data.value.meta.total }} total)</span>
          <button class="secondary" :disabled="closedPage >= closedSamples.data.value.meta.pages" @click="goPage('closed', 1)">Next →</button>
        </div>
      </template>
    </template>

    <!-- Archived tab -->
    <template v-else-if="activeTab === 'archived'">
      <EndpointBadge method="GET" path="/samples/archived" />
      <p class="muted">Archived projects.</p>
      <p v-if="archivedSamples.loading.value" class="muted">Loading…</p>
      <p v-else-if="archivedSamples.error.value" class="error-text">{{ archivedSamples.error.value.message }}</p>
      <p v-else-if="!archivedSamples.data.value?.samples?.length" class="muted">No archived projects.</p>
      <template v-else>
        <table>
          <thead>
            <tr><th>ID</th><th>Name</th><th>Limit</th><th>Completed</th><th>Current cost</th><th>Created</th><th>Closed at</th><th>Archived at</th></tr>
          </thead>
          <tbody>
            <tr
              v-for="p in archivedSamples.data.value.samples"
              :key="p.id"
              class="clickable"
              @click="goToProject(p.id)"
            >
              <td>{{ p.id }}</td>
              <td>{{ p.name }}</td>
              <td>{{ p.limit }}</td>
              <td>{{ p.statistics?.completed ?? 0 }}</td>
              <td>{{ p.statistics?.currentCost || '—' }}</td>
              <td>{{ p.createdAt }}</td>
              <td>{{ p.closedAt }}</td>
              <td>{{ p.archivedAt }}</td>
            </tr>
          </tbody>
        </table>
        <div v-if="archivedSamples.data.value.meta?.pages > 1" class="pagination">
          <button class="secondary" :disabled="archivedPage === 1" @click="goPage('archived', -1)">← Prev</button>
          <span class="muted">Page {{ archivedSamples.data.value.meta.page }} of {{ archivedSamples.data.value.meta.pages }} ({{ archivedSamples.data.value.meta.total }} total)</span>
          <button class="secondary" :disabled="archivedPage >= archivedSamples.data.value.meta.pages" @click="goPage('archived', 1)">Next →</button>
        </div>
      </template>
    </template>
  </div>
</template>

<style scoped>
.tabs {
  display: flex;
  gap: 0;
  margin: 1.25rem 0 1rem;
  border-bottom: 1px solid var(--border);
}
.tabs button {
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  padding: 0.55rem 1.1rem;
  cursor: pointer;
  color: var(--text-soft);
  font-weight: 600;
  font-size: 0.95rem;
  margin-bottom: -1px;
  border-radius: 0;
}
.tabs button:hover { color: var(--text); filter: none; }
.tabs button.active { color: var(--accent); border-bottom-color: var(--accent); }
.pagination {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-top: 1rem;
}
</style>
