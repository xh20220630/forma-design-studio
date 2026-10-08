export class LocalAgentRequestError extends Error {
  readonly upstreamStatus?: number;
  readonly upstreamCode?: string;

  constructor(input: unknown) {
    let payload: any = input;
    // Codex exec embeds an upstream JSON error inside its event's message string.
    for (let depth = 0; depth < 4; depth++) {
      if (typeof payload === 'string') {
        try {
          payload = JSON.parse(payload);
          continue;
        } catch {
          break;
        }
      }
      if (payload?.error) {
        payload = { ...payload, ...payload.error, error: undefined };
        continue;
      }
      if (typeof payload?.message === 'string' && payload.message.trim().startsWith('{')) {
        try {
          payload = { ...payload, ...JSON.parse(payload.message) };
          continue;
        } catch {
          break;
        }
      }
      break;
    }
    super(
      typeof payload === 'string' ? payload : String(payload?.message || '本地 Agent 请求失败。'),
    );
    const info = payload?.codexErrorInfo;
    const protocolStatus =
      typeof info === 'object' && info
        ? (Object.values(info).find((value: any) => Number.isInteger(value?.httpStatusCode)) as
            | { httpStatusCode: number }
            | undefined)
        : undefined;
    const status =
      payload?.status ??
      payload?.statusCode ??
      protocolStatus?.httpStatusCode ??
      (info === 'badRequest' ? 400 : info === 'unauthorized' ? 401 : undefined);
    this.upstreamStatus =
      Number.isInteger(status) && status >= 400 && status <= 599 ? status : undefined;
    this.upstreamCode =
      typeof payload?.code === 'string'
        ? payload.code
        : typeof payload?.type === 'string' && !['error', 'turn.failed'].includes(payload.type)
          ? payload.type
          : typeof info === 'string'
            ? info
            : undefined;
  }
}
