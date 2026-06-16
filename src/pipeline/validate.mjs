export function validateData(data) {
  if (!data || typeof data !== 'object') {
    return { ok: false, error: 'data must be object' };
  }
  if (!data.slug || typeof data.slug !== 'string') {
    return { ok: false, error: 'missing slug' };
  }
  if (!Array.isArray(data.companies) || data.companies.length !== 6) {
    return { ok: false, error: 'expected 6 companies' };
  }
  const cnCount = data.companies.filter(c => c.region === 'cn').length;
  const intlCount = data.companies.filter(c => c.region === 'intl').length;
  if (cnCount !== 3 || intlCount !== 3) {
    return { ok: false, error: 'expected 3 cn + 3 intl region companies' };
  }
  for (const c of data.companies) {
    if (!c.id || !c.name || !c.domain || !Array.isArray(c.news)) {
      return { ok: false, error: `company ${c.id || 'unknown'} missing required fields` };
    }
  }
  return { ok: true };
}
