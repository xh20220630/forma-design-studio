import type { ProjectMeta, ValidationIssue } from '@forma/schema/workbench';
import { safeId } from '../../domain/constants.ts';
import type { WorkspaceFiles } from '../../infrastructure/filesystem/workspace-files.ts';
import type { JsonObject } from '../../types/json.ts';
import { isObject, numberValue, stringValue } from '../../utils/json.ts';
import { slug } from '../../utils/strings.ts';
import { issue } from '../../utils/validation.ts';

export async function loadProject(
  projectRaw: JsonObject,
  storage: WorkspaceFiles,
  issues: ValidationIssue[],
): Promise<ProjectMeta> {
  const projectSchema = numberValue(projectRaw.schema_version, 1) === 2 ? 2 : 1;
  const projectName = stringValue(projectRaw.name, 'Untitled design');
  const themeRaw = isObject(projectRaw.theme) ? projectRaw.theme : {};
  const project: ProjectMeta = {
    schemaVersion: projectSchema,
    revision: numberValue(projectRaw.revision, 0),
    id: stringValue(projectRaw.id, slug(projectName)),
    name: projectName,
    theme: {
      id: stringValue(themeRaw.id, 'default'),
      version: stringValue(themeRaw.version, '0.0.0'),
      status: themeRaw.status === 'approved' ? 'approved' : 'draft',
      confirmation: stringValue(themeRaw.confirmation),
      designPath: stringValue(themeRaw.design_path, 'DESIGN.md'),
      tokensPath: stringValue(themeRaw.tokens_path, 'tokens.json'),
      ...(typeof themeRaw.anchor_image === 'string' ? { anchorImage: themeRaw.anchor_image } : {}),
    },
  };
  if (!safeId.test(project.id))
    issue(
      issues,
      'error',
      'invalid-project-id',
      'project.json',
      '项目 ID 必须使用小写字母、数字和连字符。',
    );
  for (const [label, relative] of [
    ['DESIGN', project.theme.designPath],
    ['Tokens', project.theme.tokensPath],
  ] as const) {
    try {
      await storage.readBytes(relative, issues);
    } catch {
      issue(issues, 'error', 'missing-project-resource', relative, `${label} 资源不存在。`);
    }
  }
  if (project.theme.anchorImage) {
    try {
      await storage.resolveAsset(project.theme.anchorImage);
    } catch {
      issue(
        issues,
        'error',
        'invalid-anchor-image',
        project.theme.anchorImage,
        '主题锚点图片不存在或路径不安全。',
      );
    }
  }

  return project;
}
