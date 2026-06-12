import { ref } from 'vue';

/**
 * Tiny async-state helper: wraps any promise-returning function with
 * {data, error, loading}. Keeps views free of repetitive try/catch.
 *
 *   const surveys = useAsync(() => api.get(`/samples/${id}/subsets`));
 *   surveys.run();           // later: surveys.data / .loading / .error
 */
export function useAsync(fn) {
  const data = ref(null);
  const error = ref(null);
  const loading = ref(false);

  async function run(...args) {
    loading.value = true;
    error.value = null;
    try {
      data.value = await fn(...args);
      return data.value;
    } catch (e) {
      error.value = e;
      throw e;
    } finally {
      loading.value = false;
    }
  }

  return { data, error, loading, run };
}
