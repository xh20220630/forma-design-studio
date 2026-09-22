try { process.loadEnvFile?.(); } catch (error) { if (error.code !== 'ENOENT') throw error; }

export const apiPort = Number(process.env.FORMA_PORT || 4310);
export const allowedOrigins = new Set(['http://127.0.0.1:5173', 'http://localhost:5173', 'http://127.0.0.1:4173', 'http://localhost:4173', `http://127.0.0.1:${apiPort}`, `http://localhost:${apiPort}`, ...(process.env.FORMA_ALLOWED_ORIGINS || '').split(',').filter(Boolean)]);
