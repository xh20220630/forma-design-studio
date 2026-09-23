if (!process.env.npm_config_user_agent?.startsWith('pnpm/')) {
  console.error('This repository uses pnpm workspaces. Run: corepack enable && pnpm install');
  process.exit(1);
}
