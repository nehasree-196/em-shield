// api.js — the only file that talks to the FastAPI backend (requests go through the Vite /api proxy).
async function request(path, options) {
  const res = await fetch(`/api${path}`, options);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const detail = Array.isArray(body.detail)
      ? body.detail.map((d) => `${(d.loc || []).slice(1).join('.')}: ${d.msg}`).join('; ')
      : body.detail || `Request failed (${res.status})`;
    throw new Error(detail);
  }
  return res.json();
}

const post = (path, body) =>
  request(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

export const getMaterials = () => request('/materials');
export const runSingleLayer = (body) => post('/single-layer', body);
export const runMultilayer = (body) => post('/multilayer', body);
export const runSweep = (body) => post('/sweep', body);
