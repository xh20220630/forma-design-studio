import type { ProjectMeta, TokenCollection, ValidationIssue } from '@forma/schema/workbench';
import { tokenGroupNames } from './constants.ts';
import type { JsonObject } from '../types/json.ts';
import { isObject, numberValue, stringValue } from '../utils/json.ts';
import { issue } from '../utils/validation.ts';

export function parseTokens(
  tokensRaw: JsonObject,
  project: ProjectMeta,
  issues: ValidationIssue[],
): TokenCollection {
  const tokenValues = isObject(tokensRaw.tokens) ? tokensRaw.tokens : {};
  if (numberValue(tokensRaw.schema_version, 1) === 2) {
    for (const group of tokenGroupNames) {
      if (!isObject(tokenValues[group]))
        issue(
          issues,
          'error',
          'missing-token-group',
          'tokens.json',
          `v2 Tokens 必须包含对象分组：${group}`,
        );
    }
  }
  const tokens: TokenCollection = {
    schemaVersion: numberValue(tokensRaw.schema_version, 1) === 2 ? 2 : 1,
    themeVersion: stringValue(tokensRaw.theme_version, project.theme.version),
    tokens: {
      color: isObject(tokenValues.color) ? tokenValues.color : {},
      typography: isObject(tokenValues.typography) ? tokenValues.typography : {},
      spacing: isObject(tokenValues.spacing) ? tokenValues.spacing : {},
      radius: isObject(tokenValues.radius) ? tokenValues.radius : {},
      shadow: isObject(tokenValues.shadow) ? tokenValues.shadow : {},
      layout: isObject(tokenValues.layout) ? tokenValues.layout : {},
      motion: isObject(tokenValues.motion) ? tokenValues.motion : {},
    },
  };

  return tokens;
}
