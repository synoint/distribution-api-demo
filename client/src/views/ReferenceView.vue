<script setup>
import { ref, watch } from 'vue';
import { api } from '@/api';
import { useAsync } from '@/composables/useAsync';
import { useConstants } from '@/composables/useConstants';
import EndpointBadge from '@/components/EndpointBadge.vue';
import TestModeDisclaimer from '@/components/TestModeDisclaimer.vue';

/**
 * Browser for all read-only /reference/* lookups — the data you need when
 * building a survey payload (ids for countries, languages, regions,
 * profiling answers, providers, panels).
 */
const TABS = ['Countries', 'Languages', 'Genders', 'Statuses', 'Providers', 'Panels', 'Questions'];
const tab = ref('Countries');

// Status explanations (shared with the API guide via /api/meta/constants).
const constants = useConstants();

const countries = useAsync(() => api.get('/reference/countries'));
const languages = useAsync(() => api.get('/reference/languages'));
const genders = useAsync(() => api.get('/reference/genders'));
const statuses = useAsync(() => api.get('/reference/statuses'));
const providers = useAsync(() => api.get('/reference/providers'));

const loaders = {
  Countries: countries, Languages: languages, Genders: genders,
  Statuses: statuses, Providers: providers,
};
watch(tab, (next) => { if (loaders[next] && !loaders[next].data.value) loaders[next].run(); }, { immediate: true });

/* Countries drill-down: GET /reference/countries/{id} lists region types → regions. */
const selectedCountry = ref(null);
const countryDetail = useAsync(() => api.get(`/reference/countries/${selectedCountry.value}`));
watch(selectedCountry, (id) => { if (id) countryDetail.run(); });

/* Providers drill-down: countries (with languages) a provider can field in.
   Collection key upstream: `providerCountryLanguages`. */
const selectedProvider = ref(null);
const providerCountries = useAsync(() => api.get(`/reference/providers/${selectedProvider.value}/countries`));
watch(selectedProvider, (id) => { if (id) providerCountries.run(); });
const expandedProviderCountry = ref(null);

/* Panels: optional `country` and `provider` filters.
   Note: for test accounts the API returns the dedicated test panel and
   ignores the filters. */
const panelCountry = ref('');
const panelProvider = ref('');
const panels = useAsync(() => {
  const params = new URLSearchParams();
  if (panelCountry.value) params.set('country', panelCountry.value);
  if (panelProvider.value) params.set('provider', panelProvider.value);
  const qs = params.size ? `?${params}` : '';
  return api.get(`/reference/panels${qs}`);
});
watch(tab, (next) => { if (next === 'Panels' && !panels.data.value) panels.run(); });

/* Questions: per-country profiling questions.
   Collection key upstream: `profilingQuestions`; answers carry `label`. */
const questionCountry = ref('');
const questions = useAsync(() => api.get(`/reference/questions?countryId=${questionCountry.value}`));
</script>

<template>
  <div class="page">
    <h1>Reference data</h1>
    <p class="page-intro">
      Read-only lookups that supply every id used in survey payloads:
      <code>countryId</code>, <code>languageId</code>, <code>regionIds</code>,
      <code>profilingIds</code>, provider and panel ids.
    </p>

    <nav class="tabs">
      <button v-for="name in TABS" :key="name" class="secondary" :class="{ active: tab === name }" @click="tab = name">
        {{ name }}
      </button>
    </nav>

    <div v-if="tab === 'Countries'" class="card">
      <EndpointBadge method="GET" path="/reference/countries" />
      <EndpointBadge method="GET" path="/reference/countries/{id}" />
      <p class="muted">Click a country to load its regions (→ <code>regionIds</code>).</p>
      <table v-if="countries.data.value">
        <thead><tr><th>ID</th><th>Name</th><th>ISO</th><th>IR range</th><th>LOI range</th><th>Min age</th></tr></thead>
        <tbody>
          <tr v-for="country in countries.data.value.countries" :key="country.id" class="clickable" @click="selectedCountry = country.id">
            <td>{{ country.id }}</td><td>{{ country.name }}</td><td>{{ country.isoCode }}</td>
            <td>{{ country.incidenceRateMin }}–{{ country.incidenceRateMax }}%</td>
            <td>{{ country.lengthOfInterviewMin }}–{{ country.lengthOfInterviewMax }}</td>
            <td>{{ country.ageMin }}</td>
          </tr>
        </tbody>
      </table>
      <template v-if="selectedCountry && countryDetail.data.value">
        <h3>Regions of {{ countryDetail.data.value.name }}</h3>
        <table>
          <thead><tr><th>Region type</th><th>Region ID</th><th>Region</th></tr></thead>
          <tbody>
            <template v-for="regionType in countryDetail.data.value.regionTypes ?? []" :key="regionType.id">
              <tr v-for="region in regionType.regions" :key="region.id">
                <td>{{ regionType.name }}</td><td>{{ region.id }}</td><td>{{ region.name }}</td>
              </tr>
            </template>
          </tbody>
        </table>
      </template>
    </div>

    <div v-if="tab === 'Languages'" class="card">
      <EndpointBadge method="GET" path="/reference/languages" />
      <table v-if="languages.data.value">
        <thead><tr><th>ID</th><th>Name</th><th>ISO</th><th>Locale</th></tr></thead>
        <tbody>
          <tr v-for="lang in languages.data.value.languages" :key="lang.id">
            <td>{{ lang.id }}</td><td>{{ lang.name }}</td><td>{{ lang.isoCode }}</td><td>{{ lang.locale }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="tab === 'Genders'" class="card">
      <EndpointBadge method="GET" path="/reference/genders" />
      <p class="muted">The id is what goes into the survey's <code>gender</code> field.</p>
      <table v-if="genders.data.value">
        <thead><tr><th>ID</th><th>Name</th></tr></thead>
        <tbody>
          <tr v-for="gender in genders.data.value.genders" :key="gender.id">
            <td>{{ gender.id }}</td><td>{{ gender.name }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="tab === 'Statuses'" class="card">
      <EndpointBadge method="GET" path="/reference/statuses" />
      <p class="muted">Survey lifecycle statuses — see the API guide for transitions.</p>
      <table v-if="statuses.data.value">
        <thead><tr><th>ID</th><th>Name</th><th>Meaning</th></tr></thead>
        <tbody>
          <tr v-for="status in statuses.data.value.statuses" :key="status.id">
            <td>{{ status.id }}</td><td>{{ status.name }}</td>
            <td>{{ constants?.surveyStatusDescriptions?.[status.id] }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="tab === 'Providers'" class="card">
      <EndpointBadge method="GET" path="/reference/providers" />
      <EndpointBadge method="GET" path="/reference/providers/{id}/countries" />
      <p class="muted">Click a provider to load the countries (and languages) it can field in.</p>
      <TestModeDisclaimer>
        for test accounts the API lists only the test provider — the full marketplace catalog is
        not returned.
      </TestModeDisclaimer>
      <table v-if="providers.data.value">
        <thead><tr><th>ID</th><th>Name</th></tr></thead>
        <tbody>
          <tr v-for="provider in providers.data.value.providers" :key="provider.id" class="clickable" @click="selectedProvider = provider.id">
            <td>{{ provider.id }}</td><td>{{ provider.name }}</td>
          </tr>
        </tbody>
      </table>
      <template v-if="selectedProvider && providerCountries.data.value">
        <h3>Countries served by provider {{ selectedProvider }}</h3>
        <p class="muted">Click a row to list the languages available in that country.</p>
        <table>
          <thead><tr><th>Country ID</th><th>Name</th><th>Min age</th><th>Languages</th></tr></thead>
          <tbody>
            <template v-for="country in providerCountries.data.value.providerCountryLanguages" :key="country.countryId">
              <tr class="clickable" @click="expandedProviderCountry = expandedProviderCountry === country.countryId ? null : country.countryId">
                <td>{{ country.countryId }}</td><td>{{ country.name }}</td><td>{{ country.ageMin }}</td>
                <td>{{ country.languages?.length ?? 0 }}</td>
              </tr>
              <tr v-if="expandedProviderCountry === country.countryId">
                <td colspan="4">
                  <code v-for="lang in country.languages" :key="lang.id" style="margin: 0 0.25rem 0.25rem 0; display: inline-block">
                    {{ lang.id }} · {{ lang.name }}
                  </code>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </template>
    </div>

    <div v-if="tab === 'Panels'" class="card">
      <EndpointBadge method="GET" path="/reference/panels?country=…&provider=…" />
      <p class="muted">
        Panel ids go into a survey provider's <code>panelIds</code>. Both filters are optional.
      </p>
      <TestModeDisclaimer>
        for test accounts the API skips the <code>country</code> and <code>provider</code> filters
        and always returns the dedicated test panel.
      </TestModeDisclaimer>
      <div class="row">
        <label class="field"><span>Country ID</span>
          <input v-model="panelCountry" type="number" placeholder="any" style="max-width: 8rem" />
        </label>
        <label class="field"><span>Provider ID</span>
          <input v-model="panelProvider" type="number" placeholder="any" style="max-width: 8rem" />
        </label>
        <button class="secondary" :disabled="panels.loading.value" @click="panels.run">Load panels</button>
      </div>
      <table v-if="panels.data.value">
        <thead><tr><th>ID</th><th>Reference ID</th><th>Name</th><th>Provider</th><th>Country ID</th></tr></thead>
        <tbody>
          <tr v-for="panel in panels.data.value.panels" :key="panel.id">
            <td>{{ panel.id }}</td><td>{{ panel.referenceId }}</td><td>{{ panel.name }}</td>
            <td>{{ panel.provider }}</td><td>{{ panel.countryId }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="tab === 'Questions'" class="card">
      <EndpointBadge method="GET" path="/reference/questions?countryId=…" />
      <p class="muted">Answer ids (not question ids) go into the survey's <code>profilingIds</code>.</p>
      <div class="row">
        <label class="field"><span>Country ID</span>
          <input v-model="questionCountry" type="number" placeholder="e.g. 1" style="max-width: 8rem" />
        </label>
        <button class="secondary" :disabled="!questionCountry || questions.loading.value" @click="questions.run">
          Load questions
        </button>
      </div>
      <table v-if="questions.data.value">
        <thead><tr><th>ID</th><th>Question</th><th>Answers (id · label)</th></tr></thead>
        <tbody>
          <tr v-for="question in questions.data.value.profilingQuestions" :key="question.id">
            <td>{{ question.id }}</td>
            <td>{{ question.label }}</td>
            <td>
              <div v-for="answer in question.answers" :key="answer.id" class="answer-row">
                <code>{{ answer.id }}</code> {{ answer.label }}
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.tabs { display: flex; gap: 0.4rem; flex-wrap: wrap; margin: 1rem 0; }
.tabs button.active { background: var(--accent); color: #fff; }
.answer-row { margin: 0.15rem 0; }
.answer-row code { margin-right: 0.35rem; }
</style>
