import './config.mjs';
import { spawn } from 'node:child_process';
import path from 'node:path';

const api = spawn(process.execPath, ['--watch', path.resolve('server/index.mjs')], { stdio: 'inherit', windowsHide: true });
const web = spawn(process.execPath, [path.resolve('node_modules/vite/bin/vite.js'), '--host', '127.0.0.1'], { stdio: 'inherit', windowsHide: true });
let stopping = false;
function stop(code = 0) { if (stopping) return; stopping = true; api.kill(); web.kill(); process.exitCode = code; }
process.on('SIGINT', () => stop()); process.on('SIGTERM', () => stop());
api.on('exit', code => stop(code || 0)); web.on('exit', code => stop(code || 0));
api.on('error', error => { console.error(error.message); stop(1); }); web.on('error', error => { console.error(error.message); stop(1); });
