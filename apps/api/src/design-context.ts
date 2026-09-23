import type { Project } from '@forma/schema';
import { createHash } from 'node:crypto';

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable((value as Record<string, unknown>)[key])]));
  return value;
}

export function designContext(project: Project) {
  return { name: project.name, description: project.description, tokens: activeProjectTokens(project), themeModes: project.themeModes, activeMode: project.activeMode, variableCollections: project.variableCollections, activeVariableModes: project.activeVariableModes, components: project.components, pages: project.pages.map(({ id, name, width, height }) => ({ id, name, width, height })) };
}

export function activeProjectTokens(project: Project) {
  return project.activeMode && project.themeModes && Object.hasOwn(project.themeModes, project.activeMode) ? project.themeModes[project.activeMode] : project.tokens;
}

export function designContextHash(project: Project) {
  return createHash('sha256').update(JSON.stringify(stable(designContext(project)))).digest('hex');
}

export function currentGeneration(current: Project | undefined, incoming: Project) {
  if (!current?.generation) return undefined;
  if (designContextHash(current) === designContextHash(incoming)) return current.generation;
  return { ...current.generation, approved: false };
}
