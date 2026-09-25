import type { PageKind, Platform } from '@forma/schema/workbench';

export const pageKinds = new Set<PageKind>(['page', 'modal', 'drawer', 'state']);
export const platforms = new Set<Platform>(['desktop', 'mobile']);
export const safeId = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const semanticVersion = /^(\d+)\.\d+\.\d+(?:[-+].+)?$/;
export const supportedImages = new Set(['.png', '.jpg', '.jpeg', '.webp']);
export const tokenGroupNames = [
  'color',
  'typography',
  'spacing',
  'radius',
  'shadow',
  'layout',
  'motion',
] as const;
export const exitTransitionIntents = new Set(['close', 'cancel', 'success', 'back']);
export const transitionIntents = new Set(['open', 'navigate', ...exitTransitionIntents]);
export const exitTransitionWords =
  /(?:关闭|取消|完成|成功|确认|返回|close|cancel|done|success|confirm|back)/i;
