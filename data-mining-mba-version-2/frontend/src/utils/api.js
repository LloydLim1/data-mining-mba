const BASE = "http://localhost:8000";

async function apiFetch(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "API error");
  }
  return res.json();
}

export const api = {
  getDatasets:        ()         => apiFetch("/api/datasets"),
  getIterations:      (ds)       => apiFetch(`/api/iterations/${ds}`),
  getIterationDetail: (ds, num)  => apiFetch(`/api/iterations/${ds}/${num}`),
  getRecommendations: (ds)       => apiFetch(`/api/recommendations/${ds}`),
  getBundles:         (ds)       => apiFetch(`/api/bundles/${ds}`),
  getHomepage:        (ds)       => apiFetch(`/api/homepage/${ds}`),
  getPromos:          (ds)       => apiFetch(`/api/promos/${ds}`),
  getRules:           (ds, lift) => apiFetch(`/api/rules/${ds}?min_lift=${lift || 1}&limit=50`),
  getDrift:           (ds)       => apiFetch(`/api/drift/${ds}`),
  getCrossSell:       (ds, item) => apiFetch("/api/cross-sell", {
    method: "POST",
    body: JSON.stringify({ dataset_id: ds, item }),
  }),
  runIteration: (payload) => apiFetch("/api/run-iteration", {
    method: "POST",
    body: JSON.stringify(payload),
  }),
  reset: (ds) => apiFetch(`/api/reset/${ds}`, { method: "DELETE" }),
  uploadDataset: async (dsId, file, name) => {
    const form = new FormData();
    form.append("file", file);
    const params = name ? `?name=${encodeURIComponent(name)}` : "";
    const res = await fetch(`${BASE}/api/upload-dataset/${encodeURIComponent(dsId)}${params}`, {
      method: "POST",
      body: form,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || "Upload failed");
    }
    return res.json();
  },
  deleteDataset: (ds) => apiFetch(`/api/dataset/${ds}`, { method: "DELETE" }),
};
