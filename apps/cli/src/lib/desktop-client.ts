import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import {
  type AutomationErrorCode,
  type AutomationRequest,
  AutomationRequestSchema,
  type AutomationResponse,
  AutomationResponseSchema,
} from '@timenote/core';

export const EXIT_GENERIC = 1;
export const EXIT_PROTOCOL = 2;
export const EXIT_CONFLICT = 3;
export const EXIT_UNAVAILABLE = 4;
export const EXIT_UNAUTHORIZED = 5;
export const EXIT_NOT_FOUND = 6;
export const EXIT_OUTCOME_UNKNOWN = 7;

export class DesktopCliError extends Error {
  readonly code: AutomationErrorCode | 'CLI_ERROR';
  readonly retryable: boolean;
  readonly exitCode: number;

  constructor(
    code: AutomationErrorCode | 'CLI_ERROR',
    message: string,
    options?: { retryable?: boolean; exitCode?: number },
  ) {
    super(message);
    this.name = 'DesktopCliError';
    this.code = code;
    this.retryable = options?.retryable ?? false;
    this.exitCode = options?.exitCode ?? 1;
  }
}

export interface DesktopDescriptor {
  endpoint: string;
  instanceId: string;
  protocolVersion: number;
  startedAt?: string;
}

function desktopConfigDir(): string {
  const override = process.env.TIMENOTE_DESKTOP_DIR;
  if (override) return override;
  if (process.env.XDG_CONFIG_HOME) return path.join(process.env.XDG_CONFIG_HOME, 'timenote');
  const home = process.env.HOME ?? '';
  return path.join(home, '.config', 'timenote');
}

export function readDescriptor(): DesktopDescriptor | null {
  const file = path.join(desktopConfigDir(), 'automation', 'descriptor.json');
  if (!existsSync(file)) return null;
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf-8')) as DesktopDescriptor;
    if (!parsed.endpoint || !parsed.instanceId) return null;
    return parsed;
  } catch {
    return null;
  }
}

function readToken(): string | null {
  const file = path.join(desktopConfigDir(), 'automation', 'credentials.json');
  if (!existsSync(file)) return null;
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf-8')) as { token?: string };
    return parsed.token ?? null;
  } catch {
    return null;
  }
}

export interface DesktopClient {
  execute(request: AutomationRequest): Promise<AutomationResponse>;
  getOperation(operationId: string): Promise<AutomationResponse>;
}

/**
 * Creates a client bound to the running Desktop instance. Fails with
 * DESKTOP_UNAVAILABLE (exit 4) when no descriptor/credentials exist or the
 * endpoint does not answer — no silent fallback to direct file writes.
 */
export async function createDesktopClient(): Promise<DesktopClient> {
  const descriptor = readDescriptor();
  if (!descriptor) {
    throw new DesktopCliError(
      'DESKTOP_UNAVAILABLE',
      'TimeNote Desktop is not reachable: no automation descriptor found. Start the Desktop app and enable "Agent 连接" in Settings.',
      { exitCode: EXIT_UNAVAILABLE },
    );
  }
  if (descriptor.protocolVersion !== 1) {
    throw new DesktopCliError(
      'PROTOCOL_MISMATCH',
      `desktop protocol ${descriptor.protocolVersion} is not supported by this CLI`,
      {
        exitCode: EXIT_PROTOCOL,
      },
    );
  }
  const token = readToken();
  if (!token) {
    throw new DesktopCliError(
      'UNAUTHORIZED',
      'automation credentials missing; re-enable Agent 连接 in Desktop settings',
      {
        exitCode: EXIT_UNAUTHORIZED,
      },
    );
  }

  const endpoint = descriptor.endpoint;

  async function post(
    pathname: string,
    body?: unknown,
    timeoutMs = 95_000,
  ): Promise<AutomationResponse> {
    let res: Response;
    try {
      res = await fetch(`${endpoint}${pathname}`, {
        method: body === undefined ? 'GET' : 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      throw new DesktopCliError(
        'DESKTOP_UNAVAILABLE',
        `cannot reach TimeNote Desktop at ${endpoint}`,
        {
          exitCode: EXIT_UNAVAILABLE,
          retryable: true,
        },
      );
    }

    let parsed: unknown;
    try {
      parsed = await res.json();
    } catch {
      throw new DesktopCliError(
        'INTERNAL_ERROR',
        `invalid response from desktop (HTTP ${res.status})`,
      );
    }
    const validated = AutomationResponseSchema.safeParse(parsed);
    if (!validated.success) {
      throw new DesktopCliError('INTERNAL_ERROR', 'malformed response envelope from desktop');
    }
    return validated.data as AutomationResponse;
  }

  async function executeRaw(request: AutomationRequest): Promise<AutomationResponse> {
    // re-validate with the shared schema before sending
    const check = AutomationRequestSchema.safeParse(request);
    if (!check.success) {
      throw new DesktopCliError(
        'CLI_ERROR',
        `invalid request: ${check.error.issues[0]?.message ?? 'unknown'}`,
      );
    }
    return post('/api/v1/operations', request);
  }

  return {
    async execute(request: AutomationRequest): Promise<AutomationResponse> {
      const response = await executeRaw(request);
      const operationId =
        'operationId' in request.operation ? request.operation.operationId : undefined;
      if (!response.ok && response.error?.code === 'OUTCOME_UNKNOWN' && operationId) {
        // The write may have landed after our timeout: poll for the recorded
        // result with the same operationId instead of retrying blindly.
        const polled = await pollOperation(post, operationId);
        if (polled) return polled;
        const retryable = response.error.retryable ?? false;
        return {
          ...response,
          error: {
            ...response.error,
            message: `${response.error.message} [operationId: ${operationId}]`,
            retryable,
          },
        };
      }
      return response;
    },
    getOperation(operationId: string): Promise<AutomationResponse> {
      return post(`/api/v1/operations/${encodeURIComponent(operationId)}`);
    },
  };
}

async function pollOperation(
  post: (pathname: string, body?: unknown, timeoutMs?: number) => Promise<AutomationResponse>,
  operationId: string,
): Promise<AutomationResponse | null> {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 2000));
    let response: AutomationResponse;
    try {
      response = await post(`/api/v1/operations/${encodeURIComponent(operationId)}`);
    } catch {
      continue;
    }
    const inProgress =
      response.error?.details && (response.error.details as { inProgress?: boolean }).inProgress;
    if (!inProgress) return response;
  }
  return null;
}

export function responseToError(response: AutomationResponse): DesktopCliError {
  const code = (response.error?.code ?? 'INTERNAL_ERROR') as AutomationErrorCode;
  const message = response.error?.message ?? 'unknown desktop error';
  const retryable = response.error?.retryable ?? false;
  let exitCode = EXIT_GENERIC;
  if (code === 'REVISION_CONFLICT' || code === 'NOTE_HAS_UNSAVED_CHANGES') exitCode = EXIT_CONFLICT;
  else if (code === 'NOTEBOOK_NOT_FOUND' || code === 'NOTE_NOT_FOUND') exitCode = EXIT_NOT_FOUND;
  else if (code === 'UNAUTHORIZED' || code === 'FORBIDDEN') exitCode = EXIT_UNAUTHORIZED;
  else if (code === 'OUTCOME_UNKNOWN') exitCode = EXIT_OUTCOME_UNKNOWN;
  return new DesktopCliError(code, message, { retryable, exitCode });
}
