<script setup>
// App shell: navigation + the production-cost warning that applies to the
// whole demo (the backend talks to the live Distribution API).
</script>

<template>
  <header class="topbar">
    <div class="inner">
      <RouterLink to="/" class="brand">Distribution API <span>demo client</span></RouterLink>
      <nav>
        <RouterLink to="/">Projects</RouterLink>
        <RouterLink to="/reference">Reference data</RouterLink>
        <RouterLink to="/guide">API guide</RouterLink>
      </nav>
    </div>
  </header>

  <main>
    <RouterView />
  </main>
</template>

<style scoped>
.topbar {
  background: var(--surface);
  border-bottom: 1px solid var(--border);
}
.inner {
  max-width: 1080px;
  margin: 0 auto;
  padding: 0.8rem 1.25rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
}
.brand {
  font-weight: 700;
  text-decoration: none;
  color: var(--text);
  font-size: 1.05rem;
}
.brand span { color: var(--accent); font-weight: 500; }
nav { display: flex; gap: 1.1rem; }
nav a {
  text-decoration: none;
  color: var(--text-soft);
  font-weight: 600;
  padding: 0.2rem 0;
  border-bottom: 2px solid transparent;
}
nav a.router-link-active { color: var(--accent); border-bottom-color: var(--accent); }

</style>
