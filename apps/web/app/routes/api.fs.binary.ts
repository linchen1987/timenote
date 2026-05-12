import { type ActionFunctionArgs, data } from 'react-router';
import { createFsClient, type FsConnection } from '~/services/fs-client';

type BinaryReadRequest = {
  connection: FsConnection;
  path: string;
};

type BinaryWriteMeta = {
  connection: FsConnection;
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
    const { connection, path } = body;

    if (!connection) return data({ error: 'Missing connection info' }, { status: 400 });
    if (!path) return data({ error: 'Missing path' }, { status: 400 });

    const client = createFsClient(connection);
    const buffer = await client.readFile(path);

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
    const { connection, path } = meta;

    if (!connection) return data({ error: 'Missing connection info' }, { status: 400 });
    if (!path) return data({ error: 'Missing path' }, { status: 400 });

    const client = createFsClient(connection);
    const buffer = await file.arrayBuffer();
    await client.writeFile(path, buffer);

    return data({ result: { success: true } });
  } catch (error) {
    const err = error as Error;
    console.error('FS Binary Write Error:', err);
    return data({ error: err.message || 'Unknown error' }, { status: 500 });
  }
}
