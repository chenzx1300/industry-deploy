export function step(n, total, label, detail = '') {
  const suffix = detail ? ` → ${detail}` : '';
  console.log(`[${n}/${total}] ${label}${suffix}`);
}

export function ok(msg) {
  console.log(`✓ ${msg}`);
}

export function fail(msg) {
  console.error(`✗ ${msg}`);
}

export function info(msg) {
  console.log(msg);
}