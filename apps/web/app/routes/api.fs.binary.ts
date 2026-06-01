import { createProviderFromConfig, type FsProviderConfig } from '@timenote/core';
import { type ActionFunctionArgs, data } from 'react-router';

type BinaryReadRequest = {
  config: FsProviderConfig;
  path: string;
};

type BinaryWriteMeta = {
  config: FsProviderConfig;
  path: string;
};

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return data({ error: 'Method not allowed' }, { status: 405 });
  }

  const contentType = request.headers.get('Content-Type') || '';
  if (contentType.includes('multipart/form-data')) {
    return handleWrite(request);
  }
  return handleRead(request);
}

async function handleRead(request: Request) {
  try {
    const body = (await request.json()) as BinaryReadRequest;
    const { config, path } = body;

    if (!config) return data({ error: 'Missing config' }, { status: 400 });
    if (!path) return data({ error: 'Missing path' }, { status: 400 });

    const transport = createProviderFromConfig(config);
    const buffer = await transport.readBinary(path);

    return new Response(buffer, {
      status: 200,
      headers: { 'Content-Type': 'application/octet-stream' },
    });
  } catch (error) {
    const err = error as Error;
    console.error('FS Binary Read Error:', err);
    return data({ error: err.message || 'Unknown error' }, { status: 500 });
  }
}

async function handleWrite(request: Request) {
  try {
    const formData = await request.formData();
    const metaRaw = formData.get('meta');
    const file = formData.get('file');

    if (!metaRaw || typeof metaRaw !== 'string') {
      return data({ error: 'Missing meta' }, { status: 400 });
    }
    if (!file || !(file instanceof Blob)) {
      return data({ error: 'Missing file' }, { status: 400 });
    }

    const meta = JSON.parse(metaRaw) as BinaryWriteMeta;
    const { config, path } = meta;

    if (!config) return data({ error: 'Missing config' }, { status: 400 });
    if (!path) return data({ error: 'Missing path' }, { status: 400 });

    const transport = createProviderFromConfig(config);
    const buffer = await file.arrayBuffer();
    await transport.writeBinary(path, buffer);

    return data({ result: { success: true } });
  } catch (error) {
    const err = error as Error;
    console.error('FS Binary Write Error:', err);
    return data({ error: err.message || 'Unknown error' }, { status: 500 });
  }
}
