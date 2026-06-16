export function slugify(input) {
  if (typeof input !== 'string' || input.trim() === '') {
    throw new Error('invalid prompt: must be non-empty string');
  }
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function buildSlug(prompt) {
  return `${slugify(prompt)}-industry`;
}
