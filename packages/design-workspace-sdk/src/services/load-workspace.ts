import type { ValidationIssue, ValidationReport, WorkspaceDocument } from '@forma/schema/workbench';
import { calculateDesignSystemImpacts } from '../domain/design-system.ts';
import { validateFlowReferences } from '../domain/flow-validation.ts';
import { parseTokens } from '../domain/tokens.ts';
import { WorkspaceValidationError } from '../errors/workspace-errors.ts';
import type { WorkspaceFiles } from '../infrastructure/filesystem/workspace-files.ts';
import type { JsonObject } from '../types/json.ts';
import { issue } from '../utils/validation.ts';
import { loadComponents } from './loading/components.ts';
import { loadFlows } from './loading/flows.ts';
import { loadProject } from './loading/project.ts';

export async function loadWorkspace(
  storage: WorkspaceFiles,
): Promise<{ document?: WorkspaceDocument; report: ValidationReport }> {
  const issues: ValidationIssue[] = [];
  let projectRaw: JsonObject;
  let tokensRaw: JsonObject;
  let componentsRaw: JsonObject;
  let flowsRaw: JsonObject;
  try {
    [projectRaw, tokensRaw, componentsRaw, flowsRaw] = await Promise.all([
      storage.readJson('project.json'),
      storage.readJson('tokens.json'),
      storage.readJson('components/index.json'),
      storage.readJson('flows/index.json'),
    ]);
  } catch (error) {
    issue(
      issues,
      'error',
      'missing-root-contract',
      '.',
      error instanceof Error ? error.message : '无法读取设计根契约。',
    );
    return { report: { valid: false, issues } };
  }

  const project = await loadProject(projectRaw, storage, issues);
  const tokens = parseTokens(tokensRaw, project, issues);
  const { components, componentKeys } = await loadComponents(componentsRaw, storage, issues);
  const { flows, pageRefs, relatedByFlow } = await loadFlows(
    flowsRaw,
    project,
    componentKeys,
    storage,
    issues,
  );
  validateFlowReferences(flows, pageRefs, relatedByFlow, issues);
  const impacts = calculateDesignSystemImpacts(components, tokens, flows);
  const report = {
    valid: !issues.some((item) => item.severity === 'error'),
    issues,
  };
  const document: WorkspaceDocument = {
    project,
    designSystem: { tokens, components, impacts },
    flows,
    revision: project.revision,
  };
  return { document, report };
}

export async function readWorkspace(storage: WorkspaceFiles): Promise<WorkspaceDocument> {
  const loaded = await loadWorkspace(storage);
  if (!loaded.report.valid || !loaded.document) throw new WorkspaceValidationError(loaded.report);
  return loaded.document;
}
