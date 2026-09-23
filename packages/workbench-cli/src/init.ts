import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createInterface } from 'node:readline/promises';
import { inspectSkills, installSkill, recordSkillInstallation, type SkillScope } from './skill-manager.ts';

async function writeIfMissing(file: string, content: string) {
  try { await readFile(file); return false; }
  catch { await mkdir(path.dirname(file), { recursive: true }); await writeFile(file, content); return true; }
}

async function ensureGitignore(projectRoot: string) {
  const file = path.join(projectRoot, '.gitignore');
  try {
    const current = await readFile(file, 'utf8');
    if (current.split(/\r?\n/).includes('.forma/')) return 'unchanged' as const;
    await writeFile(file, `${current}${current && !current.endsWith('\n') ? '\n' : ''}.forma/\n`);
    return 'updated' as const;
  } catch {
    await writeFile(file, '.forma/\n');
    return 'created' as const;
  }
}

async function chooseScope(): Promise<SkillScope | 'skip'> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) return 'skip';
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = (await prompt.question('安装 Forma AI UI Designer Skill？[P] 当前项目（推荐）/[G] 全局/[S] 跳过：')).trim().toLowerCase();
    if (answer === 'g' || answer === 'global') return 'global';
    if (answer === 's' || answer === 'skip') return 'skip';
    return 'project';
  } finally { prompt.close(); }
}

export async function initializeProject(options: { projectRoot: string; skill?: SkillScope | 'skip' }) {
  const projectRoot = path.resolve(options.projectRoot);
  const designRoot = path.join(projectRoot, 'design');
  await mkdir(designRoot, { recursive: true });
  const created: string[] = [];
  const files = new Map<string, string>([
    ['forma.config.json', `${JSON.stringify({ schemaVersion: 1, designRoot: './design', workbench: { openBrowser: true }, skills: { 'forma-ai-ui-designer': { requiredVersion: '^2.0.0' } } }, null, 2)}\n`],
    ['design/project.json', `${JSON.stringify({ schema_version: 2, revision: 0, id: path.basename(projectRoot).toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'design-project', name: path.basename(projectRoot), theme: { id: 'product-ui', version: '0.1.0', status: 'draft', confirmation: '', design_path: 'DESIGN.md', tokens_path: 'tokens.json' } }, null, 2)}\n`],
    ['design/DESIGN.md', '# Design system\n\n状态：draft\n\n在生成页面图片前补充业务背景、视觉方向、语义 Tokens、框架、组件共性和交互规则。\n'],
    ['design/tokens.json', `${JSON.stringify({ schema_version: 2, theme_version: '0.1.0', tokens: { color: {}, typography: {}, spacing: {}, radius: {}, shadow: {}, layout: {}, motion: {} } }, null, 2)}\n`],
    ['design/components/index.json', `${JSON.stringify({ schema_version: 2, components: [] }, null, 2)}\n`],
    ['design/flows/index.json', `${JSON.stringify({ schema_version: 2, flows: [] }, null, 2)}\n`],
  ]);
  for (const [relative, content] of files) if (await writeIfMissing(path.join(projectRoot, relative), content)) created.push(relative);
  const gitignore = await ensureGitignore(projectRoot);
  if (gitignore === 'created') created.push('.gitignore');

  const installations = await inspectSkills(projectRoot);
  const compatible = installations.find(item => item.compatible);
  let skill = compatible;
  if (!compatible) {
    const scope = options.skill || await chooseScope();
    if (scope !== 'skip') skill = await installSkill(projectRoot, scope);
  }
  if (skill) await recordSkillInstallation(projectRoot, skill);
  return { projectRoot, designRoot, created, updated: gitignore === 'updated' ? ['.gitignore'] : [], skill };
}
