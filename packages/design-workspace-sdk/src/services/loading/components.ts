import type { DesignComponentSpec, ValidationIssue } from '@forma/schema/workbench';
import { safeId, semanticVersion } from '../../domain/constants.ts';
import type { WorkspaceFiles } from '../../infrastructure/filesystem/workspace-files.ts';
import type { JsonObject } from '../../types/json.ts';
import { arrayValue, isObject, numberValue, stringArray, stringValue } from '../../utils/json.ts';
import { issue } from '../../utils/validation.ts';

export async function loadComponents(
  componentsRaw: JsonObject,
  storage: WorkspaceFiles,
  issues: ValidationIssue[],
) {
  const components: DesignComponentSpec[] = [];
  const componentKeys = new Set<string>();
  for (const value of arrayValue(componentsRaw.components)) {
    if (!isObject(value)) continue;
    const id = stringValue(value.id),
      version = stringValue(value.version),
      specPath = stringValue(value.spec_path);
    const key = `${id}@${version}`;
    const versionMatch = semanticVersion.exec(version);
    if (!safeId.test(id) || !versionMatch || !specPath) {
      issue(
        issues,
        'error',
        'invalid-component',
        'components/index.json',
        '组件必须包含有效 ID、语义化版本和规范路径。',
      );
      continue;
    }
    if (
      numberValue(componentsRaw.schema_version, 1) === 2 &&
      specPath !== `components/${id}/v${versionMatch[1]}.md`
    ) {
      issue(
        issues,
        'error',
        'invalid-component-spec-path',
        'components/index.json',
        `v2 组件规范路径必须为 components/${id}/v${versionMatch[1]}.md。`,
      );
    }
    if (componentKeys.has(key))
      issue(
        issues,
        'error',
        'duplicate-component',
        'components/index.json',
        `组件版本重复：${key}`,
      );
    componentKeys.add(key);
    let specContent = '';
    try {
      specContent = await storage.readAssetText(specPath);
    } catch {
      issue(issues, 'error', 'missing-component-spec', specPath, `组件规范不存在：${key}`);
    }
    components.push({
      id,
      version,
      name: stringValue(value.name, id),
      status:
        value.status === 'deprecated'
          ? 'deprecated'
          : value.status === 'approved'
            ? 'approved'
            : 'draft',
      scope: stringArray(value.scope),
      excludes: stringArray(value.excludes),
      tags: stringArray(value.tags),
      specPath,
      specContent,
    });
  }

  return { components, componentKeys };
}
