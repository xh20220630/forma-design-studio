import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const root = await mkdtemp(path.join(os.tmpdir(), 'forma-providers-'));
process.env.FORMA_DATA_DIR = root;
process.env.OPENAI_API_KEY = 'environment-key';
delete process.env.FORMA_AGENT_TOKEN;
await writeFile(path.join(root, 'settings.json'), JSON.stringify({ baseUrl: 'https://legacy.example/v1', apiKey: 'legacy-secret', textModel: 'old-text', imageModel: 'old-image' }));
const { createApp } = await import('../src/index.ts');
const { resolveModel, getPrivateProvider, validateProvider } = await import('../src/provider-settings.ts');
const { requestText, requestImage, listProviderModels } = await import('../src/provider-transport.ts');
const { generateJson, generateImage } = await import('../src/provider.ts');
const requests: { url: string; headers: http.IncomingHttpHeaders; body: any }[] = [];
const upstream = http.createServer(async (req, res) => {
  let raw = ''; for await (const chunk of req) raw += chunk;
  const body = raw ? JSON.parse(raw) : undefined;
  requests.push({ url: req.url!, headers: req.headers, body });
  res.setHeader('content-type', 'application/json');
  if (req.url!.startsWith('/error/')) { res.statusCode = 401; return res.end(JSON.stringify({ error: { message: 'key private-key header private-header' } })); }
  if (req.url!.startsWith('/redirect/')) { res.statusCode = 302; res.setHeader('location', '/v1/models'); return res.end('{}'); }
  if (req.url!.includes('/models') && !body) {
    if (req.headers['x-api-key']) return res.end(JSON.stringify(req.url!.includes('after_id=') ? { data: [{ id: 'claude-b', display_name: 'Claude B' }], has_more: false } : { data: [{ id: 'claude-a', display_name: 'Claude A' }], has_more: true, last_id: 'claude-a' }));
    if (req.headers['x-goog-api-key']) return res.end(JSON.stringify(req.url!.includes('pageToken=') ? { models: [{ name: 'models/gemini-b', displayName: 'Gemini B' }] } : { models: [{ name: 'models/gemini-a', displayName: 'Gemini A' }], nextPageToken: 'next' }));
    return res.end(JSON.stringify({ data: [{ id: 'text-local' }, { id: 'image-local' }] }));
  }
  if (req.url!.endsWith('/responses')) return res.end(JSON.stringify({ output: [{ type: 'message', content: [{ type: 'output_text', text: '{"protocol":"responses"}' }] }] }));
  if (req.url!.endsWith('/messages')) return res.end(JSON.stringify({ content: [{ type: 'thinking', thinking: 'hidden' }, { type: 'text', text: '{"protocol":"anthropic"}' }] }));
  if (req.url!.endsWith(':generateContent')) return res.end(JSON.stringify({ candidates: [{ content: { parts: body.generationConfig.responseModalities ? [{ inlineData: { mimeType: 'image/png', data: 'iVBORw==' } }] : [{ thought: true, text: 'hidden' }, { text: '{"protocol":"gemini"}' }] } }] }));
  if (req.url!.endsWith(':predict')) return res.end(JSON.stringify({ predictions: [{ bytesBase64Encoded: 'iVBORw==' }] }));
  if (req.url!.endsWith('/images/generations')) return res.end(JSON.stringify({ data: [{ b64_json: 'iVBORw==' }] }));
  res.end(JSON.stringify({ choices: [{ message: { content: '{"protocol":"openai"}' } }] }));
}).listen(0, '127.0.0.1');
const server = createApp().listen(0, '127.0.0.1');
await Promise.all([upstream, server].map(s => new Promise<void>(resolve => s.once('listening', resolve))));
const upstreamBase = `http://127.0.0.1:${(upstream.address() as import('node:net').AddressInfo).port}`;
const appBase = `http://127.0.0.1:${(server.address() as import('node:net').AddressInfo).port}/api`;
async function api(route: string, method = 'GET', data?: unknown) {
  const response = await fetch(appBase + route, { method, ...(data === undefined ? {} : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) }) });
  return { status: response.status, body: await response.json() };
}
after(async () => { await Promise.all([server, upstream].map(s => new Promise<void>(resolve => s.close(() => resolve())))); await rm(root, { recursive: true, force: true }); });
const messages = [{ role: 'system', content: 'Return JSON.' }, { role: 'user', content: [{ type: 'text' as const, text: 'Describe image' }, { type: 'image_url' as const, image_url: { url: 'data:image/png;base64,iVBORw==' } }] }];

test('legacy settings migrate; independent bindings route generation and keep credentials private', async () => {
  const legacy = (await api('/settings')).body;
  assert.equal(legacy.text.model, 'old-text'); assert.equal(legacy.image.model, 'old-image'); assert.equal(legacy.providers[0].hasApiKey, true);
  assert.ok(!JSON.stringify(legacy).includes('legacy-secret'));
  const textResult = await api('/providers', 'POST', { name: 'Local text', baseUrl: upstreamBase + '/text/v1', auth: 'none', imageProtocol: 'none' });
  assert.equal(textResult.status, 201);
  const textId = textResult.body.providers.at(-1).id;
  const imageResult = await api('/providers', 'POST', { name: 'Images', baseUrl: upstreamBase + '/image/v1', apiKey: 'private-key', headers: { 'X-Test': 'private-header' }, textProtocol: 'none' });
  const imageId = imageResult.body.providers.at(-1).id;
  assert.ok(!JSON.stringify(imageResult.body).includes('private-key')); assert.ok(!JSON.stringify(imageResult.body).includes('private-header'));
  const selected = (await api('/settings/models', 'POST', { text: { providerId: textId, model: 'local-text' }, image: { providerId: imageId, model: 'local-image' } })).body;
  assert.equal(selected.configured, true); assert.equal(selected.imageConfigured, true);
  assert.deepEqual(await generateJson(messages), { protocol: 'openai' });
  assert.equal(requests.at(-1)?.url, '/text/v1/chat/completions'); assert.equal(requests.at(-1)?.headers.authorization, undefined);
  const project = { id: 'routing', name: 'Routing', description: '', pages: [], components: [], tokens: {}, revision: 0 } as any;
  await generateImage(project, 'UI design');
  assert.equal(requests.at(-1)?.url, '/image/v1/images/generations'); assert.equal(requests.at(-1)?.body.model, 'local-image');
  assert.equal(requests.at(-1)?.headers.authorization, 'Bearer private-key');
  await api(`/providers/${imageId}`, 'PUT', { name: 'Renamed', apiKey: '' });
  assert.equal((await getPrivateProvider(imageId)).apiKey, 'private-key');
  const before = await readFile(path.join(root, 'settings.json'), 'utf8');
  const probe = await api('/providers/probe', 'POST', { id: imageId, baseUrl: upstreamBase + '/probe/v1' });
  assert.equal(probe.status, 200); assert.equal(probe.body.models.length, 2);
  assert.equal(await readFile(path.join(root, 'settings.json'), 'utf8'), before);
  assert.equal((await api('/settings/models', 'POST', { text: { providerId: imageId, model: 'wrong-channel' } })).status, 400);
  assert.equal((await resolveModel('text')).provider.id, textId);
  await api(`/providers/${imageId}`, 'PUT', { clearApiKey: true, headers: {} });
  assert.equal((await getPrivateProvider(imageId)).apiKey, '');
  assert.equal((await api('/settings')).body.imageConfigured, false);
  await api(`/providers/${imageId}`, 'DELETE');
  const remaining = (await api('/settings')).body;
  assert.equal(remaining.image.providerId, ''); assert.equal(remaining.text.providerId, textId);
  await api(`/providers/${textId}`, 'PUT', { textProtocol: 'none', imageProtocol: 'openai-images' });
  assert.equal((await api('/settings')).body.text.providerId, '');
});

test('protocol adapters preserve images, auth, model selection and JSON output', async () => {
  for (const protocol of ['openai', 'openai-responses', 'anthropic', 'gemini'] as const) {
    const provider = validateProvider({ name: protocol, baseUrl: upstreamBase + '/v1', apiKey: 'adapter-key', textProtocol: protocol });
    const result = await requestText(provider, 'chosen-model', messages);
    assert.equal(JSON.parse(result).protocol, protocol === 'openai-responses' ? 'responses' : protocol);
    const request = requests.at(-1)!;
    assert.ok(JSON.stringify(request.body).includes('iVBORw=='));
    if (protocol === 'anthropic') { assert.equal(request.headers['x-api-key'], 'adapter-key'); assert.equal(request.headers['anthropic-version'], '2023-06-01'); assert.equal(request.body.messages[0].content[1].source.media_type, 'image/png'); }
    else if (protocol === 'gemini') { assert.equal(request.headers['x-goog-api-key'], 'adapter-key'); assert.equal(request.body.generationConfig.responseMimeType, 'application/json'); assert.equal(request.url, '/v1/models/chosen-model:generateContent'); }
    else { assert.equal(request.headers.authorization, 'Bearer adapter-key'); assert.equal(request.body.model, 'chosen-model'); }
    if (protocol === 'openai-responses') { assert.equal(request.body.store, false); assert.equal(request.body.input[1].content[1].type, 'input_image'); }
  }
  for (const protocol of ['openai-images', 'gemini', 'imagen'] as const) {
    const provider = validateProvider({ baseUrl: upstreamBase + '/v1', apiKey: 'image-key', imageProtocol: protocol });
    assert.deepEqual(await requestImage(provider, 'image-model', 'Draw a UI'), { b64_json: 'iVBORw==' });
    if (protocol !== 'openai-images') assert.equal(requests.at(-1)?.headers['x-goog-api-key'], 'image-key');
  }
  const custom = validateProvider({ baseUrl: upstreamBase + '/custom', auth: 'api-key', apiKey: 'custom-key', textPath: 'invoke/{model}', jsonMode: false });
  await requestText(custom, 'org/model', messages);
  assert.equal(requests.at(-1)?.url, '/custom/invoke/org%2Fmodel'); assert.equal(requests.at(-1)?.headers['api-key'], 'custom-key'); assert.equal(requests.at(-1)?.body.response_format, undefined);
});

test('catalog pagination, failed requests and redirects do not expose secrets', async () => {
  for (const protocol of ['anthropic', 'gemini'] as const) {
    const models = await listProviderModels(validateProvider({ baseUrl: upstreamBase + '/v1', apiKey: 'catalog-key', textProtocol: protocol }));
    assert.equal(models.models.length, 2); assert.ok(models.models.every(m => !m.id.startsWith('models/')));
  }
  const result = await api('/providers/probe', 'POST', { baseUrl: upstreamBase + '/error', apiKey: 'private-key', headers: { 'x-custom': 'private-header' } });
  assert.equal(result.status, 502); assert.ok(!JSON.stringify(result.body).includes('private-key')); assert.ok(!JSON.stringify(result.body).includes('private-header'));
  const start = requests.length;
  const redirect = await api('/providers/probe', 'POST', { baseUrl: upstreamBase + '/redirect', apiKey: 'secret' });
  assert.equal(redirect.status, 502); assert.equal(requests.length, start + 1);
  for (const data of [{ baseUrl: 'https://user:pass@example.com/v1' }, { textPath: '//elsewhere/messages' }, { headers: { host: 'elsewhere' } }, { textProtocol: 'none', imageProtocol: 'none' }]) assert.equal((await api('/providers', 'POST', data)).status, 400);
});
