import path from 'node:path';
import { openDesignWorkspace } from '@forma/design-workspace-sdk';
import { configuredDesignRoot } from '../infrastructure/project-config.ts';
import type { CommandContext } from '../cli/arguments.ts';
import { print } from '../cli/output.ts';

export async function runValidate({ parsed, cwd, asJson }: CommandContext) {
  const root = path.resolve(parsed.positional[0] || (await configuredDesignRoot(cwd)));
  const report = await (await openDesignWorkspace({ root })).validate();
  print(
    asJson
      ? report
      : report.valid
        ? '设计资产有效。'
        : report.issues
            .map((item) => `${item.severity.toUpperCase()} ${item.path} ${item.message}`)
            .join('\n'),
    asJson,
  );
  if (!report.valid) process.exitCode = 1;
  return;
}
