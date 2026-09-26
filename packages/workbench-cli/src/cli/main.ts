import { flags } from './arguments.ts';
import { help, print } from './output.ts';
import { runInit } from '../commands/init.ts';
import { runValidate } from '../commands/validate.ts';
import { runExportHtml } from '../commands/export-html.ts';
import { runSkill } from '../commands/skill.ts';
import { runOpen } from '../commands/open.ts';

export async function main(argv = process.argv.slice(2)) {
  const [command = 'help', ...rest] = argv;
  const parsed = flags(rest);
  const context = { parsed, cwd: process.cwd(), asJson: parsed.options.has('json') };
  if (command === 'help' || command === '--help' || command === '-h') {
    print(help(), false);
    return;
  }
  if (command === 'init') return runInit(context);
  if (command === 'validate') return runValidate(context);
  if (command === 'export-html') return runExportHtml(context);
  if (command === 'skill') return runSkill(context);
  if (command === 'open') return runOpen(context);
  throw new Error(`未知命令：${command}\n\n${help()}`);
}
