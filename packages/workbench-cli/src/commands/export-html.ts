import path from 'node:path';
import { exportStaticReview } from '@forma/design-workspace-sdk/static-review';
import { configuredDesignRoot } from '../infrastructure/project-config.ts';
import type { CommandContext } from '../cli/arguments.ts';
import { print } from '../cli/output.ts';

export async function runExportHtml({ parsed, cwd, asJson }: CommandContext) {
  const root = path.resolve(parsed.positional[0] || (await configuredDesignRoot(cwd)));
  const outputOption = parsed.options.get('output');
  const output = await exportStaticReview({
    designRoot: root,
    ...(typeof outputOption === 'string' ? { output: path.resolve(outputOption) } : {}),
  });
  print(asJson ? { output } : `已导出 ${output}`, asJson);
  return;
}
