<script setup>
import { useConstants } from '@/composables/useConstants';
import EndpointBadge from '@/components/EndpointBadge.vue';

/**
 * The business-logic narrative of the Distribution API — everything a
 * consumer must understand beyond raw endpoint shapes.
 */
const constants = useConstants();
</script>

<template>
  <div class="page guide">
    <h1>Distribution API — consumer guide</h1>
    <p class="page-intro">
      How the API works end to end. The demo's backend (<code>server/src</code>) implements
      everything described here — each section names the endpoints involved.
    </p>

    <div class="card">
      <h2 style="margin-top: 0">1 · Authentication</h2>
      <p>
        Every request carries your access token in the <code>Access-token</code> header. The token
        (~140 characters) is issued by Syno International when your account is created and is tied
        to invoicing. It cannot be recovered if lost — only reissued — and must be kept secret:
        a leaked key can generate real fieldwork costs.
      </p>
      <p>
        In this demo the key lives only in <code>server/.env</code>; the browser never sees it.
        Auth failures return <code>401</code> with <code>Full authentication is required…</code>
        (missing header), <code>Access token invalid</code> (malformed) or
        <code>Access token incorrect</code> (unknown).
      </p>
    </div>

    <div class="card">
      <h2 style="margin-top: 0">2 · Terminology</h2>
      <table>
        <thead><tr><th>Docs / UI term</th><th>API term</th><th>Meaning</th></tr></thead>
        <tbody>
          <tr>
            <td>Project</td><td><code>sample</code></td>
            <td>Top-level container. Its <code>limit</code> caps completes across ALL its surveys combined — the cost control.</td>
          </tr>
          <tr>
            <td>Survey</td><td><code>subset</code></td>
            <td>One distribution: metadata (LOI, IR, field period, URLs, country, language) + targeting, quotas, providers.</td>
          </tr>
        </tbody>
      </table>
      <p class="muted">
        Limits cascade: project limit ≥ combined survey completes; a survey's limit caps its quotas.
      </p>
    </div>

    <div class="card">
      <h2 style="margin-top: 0">3 · The workflow</h2>
      <ol>
        <li>
          <strong>Look up reference data</strong> — every id used in a survey payload comes from
          <EndpointBadge method="GET" path="/reference/*" />: <code>countryId</code>,
          <code>languageId</code>, <code>regionIds</code> (from the country detail),
          <code>profilingIds</code> (answer ids from the questions list), provider and panel ids.
          See the <RouterLink to="/reference">Reference data</RouterLink> page.
        </li>
        <li>
          <strong>Create a project</strong> — <EndpointBadge method="POST" path="/samples" />
          with <code>{name, limit}</code>.
        </li>
        <li>
          <strong>Create a survey</strong> — <EndpointBadge method="POST" path="/samples/{id}/subsets" />
          with metadata, targeting (<code>countryId</code>, <code>languageId</code>, <code>gender</code>,
          ages, <code>regionIds</code>, <code>profilingIds</code>), quotas and providers.
          The survey starts in <strong>Draft</strong>.
        </li>
        <li>
          <strong>Check feasibility</strong> — <EndpointBadge method="GET" path="/subsets/{id}/feasibility" />
          returns achievable completes, estimated CPI and total cost. CPI falls with higher
          incidence rate and rises with longer interviews.
        </li>
        <li>
          <strong>Launch</strong> — <EndpointBadge method="PATCH" path="…/subsets/{id}/status" />
          with <code>{status: 3}</code> (Live). Invitations start going out; fieldwork is billable.
        </li>
        <li>
          <strong>Monitor</strong> — poll <EndpointBadge method="GET" path="/subsets/{id}/statistics" />
          and <EndpointBadge method="GET" path="/subsets/{id}/responses" />; adjust limits via
          <EndpointBadge method="PATCH" path="…/subsets/{id}/limit" /> (allowed after launch; the
          floor is the completes already achieved).
        </li>
        <li>
          <strong>Reconcile</strong> — correct response statuses via
          <EndpointBadge method="PATCH" path="…/responses/{guid}/status" /> (e.g. reject a complete
          that failed your quality checks).
        </li>
        <li>
          <strong>Close</strong> — set <code>{status: 6}</code>. Final: invoicing starts, and the
          API rejects any further change (limits, providers, modification, response statuses) with
          <code>409</code>.
        </li>
      </ol>
    </div>

    <div class="card">
      <h2 style="margin-top: 0">4 · Project lifecycle</h2>
      <p>
        Once fieldwork ends, a project (sample) moves through two further states. Each has a
        dedicated read endpoint that returns only that cohort:
      </p>
      <table>
        <thead>
          <tr><th>State</th><th>Endpoint</th><th>Meaning</th><th>Statistics</th></tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Closed</strong></td>
            <td><EndpointBadge method="GET" path="/samples/closed" /></td>
            <td>All surveys closed; invoicing started. No further edits.</td>
            <td>Live (real-time)</td>
          </tr>
          <tr>
            <td><strong>Archived</strong></td>
            <td><EndpointBadge method="GET" path="/samples/archived" /></td>
            <td>Fully archived historical record.</td>
            <td>Snapshot (frozen at archive time)</td>
          </tr>
        </tbody>
      </table>
      <p>
        The closed and archived endpoints are <strong>paginated</strong> (15 per page). Pass
        <code>?page=N</code> and read the <code>meta</code> key in the response:
      </p>
      <pre v-pre><code>GET /samples/closed?page=2
{ "samples": [...], "meta": { "total": 42, "page": 2, "perPage": 15, "pages": 3 } }</code></pre>
      <p>
        <code>PATCH /samples/{id}</code> returns <strong>409 Conflict</strong> for any non-active
        sample — the API enforces immutability once a project is closed. The
        <RouterLink to="/">Projects</RouterLink> page demonstrates this live: open a Closed project
        and submit the edit form to see the rejection.
      </p>
      <p class="muted">
        The response includes <code>closedAt</code> (closed and archived) and
        <code>archivedAt</code> (archived only) — timestamp fields not present on the general
        <code>GET /samples</code> collection.
      </p>
    </div>

    <div class="card">
      <h2 style="margin-top: 0">5 · Survey link &amp; GUID</h2>
      <p>
        Your survey's <code>url</code> and <code>testUrl</code> must contain the literal placeholder
        <code>{{ constants?.surveyUrlIdPlaceholder ?? '[ID]' }}</code>. For each panelist entering,
        the API replaces it with the response <strong>GUID</strong> (alphanumeric, ≤ 40 chars).
      </p>
      <p>
        The GUID identifies a <em>response within one survey</em> — the same person gets a different
        GUID in another survey. <strong>Capture and store it on survey entry</strong>: it is the key
        for reconciliation later.
      </p>
    </div>

    <div class="card">
      <h2 style="margin-top: 0">6 · Redirects (your survey → Syno)</h2>
      <p>
        When a respondent finishes — whatever the outcome — your survey must redirect them back to
        Syno. This registers the attempt, drives respondent remuneration and your invoicing.
        Skipping redirects breaks billing.
      </p>
      <table v-if="constants">
        <thead><tr><th>Outcome</th><th>Redirect to</th></tr></thead>
        <tbody>
          <tr><td>Completed the survey</td><td><code>{{ constants.panelistRedirects.complete }}</code></td></tr>
          <tr><td>Screened out</td><td><code>{{ constants.panelistRedirects.screenout }}</code></td></tr>
          <tr><td>Quota already full</td><td><code>{{ constants.panelistRedirects.quotaFull }}</code></td></tr>
          <tr><td>Quality screen-out</td><td><code>{{ constants.panelistRedirects.qualityScreenout }}</code></td></tr>
        </tbody>
      </table>
    </div>

    <div class="card">
      <h2 style="margin-top: 0">7 · Survey lifecycle</h2>
      <p class="muted">
        Status names below come live from <code>GET /reference/statuses</code>.
      </p>
      <table v-if="constants">
        <thead><tr><th>ID</th><th>Status</th><th>Meaning</th></tr></thead>
        <tbody>
          <tr v-for="(label, id) in constants.surveyStatusLabels" :key="id">
            <td>{{ id }}</td><td>{{ label }}</td><td>{{ constants.surveyStatusDescriptions?.[id] }}</td>
          </tr>
        </tbody>
      </table>
      <p class="muted">
        Clients may only SET Live (3), Paused (4) or Closed (6), and only along allowed transitions
        — see <code>SURVEY_STATUS_TRANSITIONS</code> in <code>server/src/distribution/constants.js</code>.
      </p>
    </div>

    <div class="card">
      <h2 style="margin-top: 0">8 · Quotas</h2>
      <p>
        A quota targets quantity (limit) by gender, age range, regions and profiling answers.
        Two modes when creating a survey:
      </p>
      <ul>
        <li>
          <strong>Automatic</strong> (recommended) — send <code>globalQuotaGroups: []</code>; the
          API builds one group per targeting dimension. Groups combine cumulatively (AND): a
          respondent must match every group.
        </li>
        <li>
          <strong>Custom</strong> — define groups yourself. Constraints (422 on violation): across
          groups only one may target regions, one gender, one age; within a group no two quotas may
          share a gender or overlap age ranges, and all must use the same targeting properties.
        </li>
      </ul>
      <p>
        Editing while in <strong>Draft</strong>: a survey modify (<code>PATCH …/subsets/{id}</code>)
        REPLACES quotas — include an existing <code>id</code> to update, omit <code>id</code> to
        create, omit the object to delete.
      </p>
      <p>
        Changing <strong>limits</strong> (allowed after launch, until Closed) via
        <code>PATCH …/subsets/{id}/limit</code>:
      </p>
      <ul>
        <li>Each quota carries its <em>own</em> limit — quotas can differ (e.g. Male 6 / Female 4).</li>
        <li>The payload must always contain the FULL structure: every group with every quota.</li>
        <li>Within each group the quota limits must <strong>sum to the survey limit</strong> (each group fully partitions it).</li>
        <li>After launch the floor is the completes already achieved; limits can never be 0.</li>
      </ul>
    </div>

    <div class="card">
      <h2 style="margin-top: 0">9 · Providers &amp; costs</h2>
      <p>
        Providers are sample marketplaces differing in country coverage and pricing. Allocate the
        survey limit across them with percentages totalling 100; optionally narrow fieldwork to
        specific <em>panels</em> (dedicated panelist pools).
      </p>
      <p>
        Cost per interview is not fixed: it decreases with a higher incidence rate and increases
        with a longer interview. Estimate before launching with the feasibility endpoint
        (<code>feasible</code>, <code>estimatedCpi</code>, <code>estimatedCost</code>) and track the
        accrued total in <code>statistics.currentCost</code> during fieldwork. For commercial terms
        and provider pricing, contact your Syno International representative.
      </p>
    </div>

    <div class="card">
      <h2 style="margin-top: 0">10 · Errors</h2>
      <p>
        The API is a standard JSON REST API: errors come back as JSON with the appropriate HTTP
        status code. Validation failures (422) include a <code>detail</code> message and a
        <code>violations</code> array naming each invalid field; auth failures (401) carry a
        <code>message</code>. The demo backend passes these through unchanged
        (<code>source: "distribution-api"</code>) so you always see the API's own response.
      </p>
    </div>
  </div>
</template>

<style scoped>
.guide ol li, .guide ul li { margin: 0.45rem 0; }
</style>
