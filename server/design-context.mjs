import { createHash } from 'node:crypto';

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
  return value;
}

export function designContext(project) {
  return { name: project.name, description: project.description, tokens: activeProjectTokens(project), themeModes: project.themeModes, activeMode: project.activeMode, variableCollections: project.variableCollections, activeVariableModes: project.activeVariableModes, components: project.components, pages: project.pages.map(({ id, name, width, height }) => ({ id, name, width, height })) };
}

export function activeProjectTokens(project) {
  return project.activeMode && project.themeModes && Object.hasOwn(project.themeModes, project.activeMode) ? project.themeModes[project.activeMode] : project.tokens;
}

export function designContextHash(project) {
  return createHash('sha256').update(JSON.stringify(stable(designContext(project)))).digest('hex');
}

export function currentGeneration(current, incoming) {
  if (!current?.generation) return undefined;
  if (designContextHash(current) === designContextHash(incoming)) return current.generation;
  return { ...current.generation, approved: false };
}
