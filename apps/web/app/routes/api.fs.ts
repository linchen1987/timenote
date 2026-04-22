import { type ActionFunctionArgs, data } from 'react-router';
import { createFsClient, type FsConnection } from '~/services/fs-client';

type BaseRequest = {
  connection: FsConnection;
  path: string;
};

type ListRequest = BaseRequest & {
  method: 'list' | 'readdir';
  args?: never;
};

type ReadRequest = BaseRequest & {
  method: 'read' | 'readFile';
  args?: never;
};

type WriteRequest = BaseRequest & {
  method: 'write' | 'writeFile';
  args: { content: string };
};

type DeleteRequest = BaseRequest & {
  method: 'delete';
  args?: never;
};

type StatRequest = BaseRequest & {
  method: 'stat';
  args?: never;
};

type EnsureDirRequest = BaseRequest & {
  method: 'ensureDir';
  args?: never;
};

type FsApiRequest =
  | ListRequest
  | ReadRequest
  | WriteRequest
  | DeleteRequest
  | StatRequest
  | EnsureDirRequest;

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return data({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const body = (await request.json()) as FsApiRequest;
    const { connection, method, path } = body;

    if (!connection) return data({ error: 'Missing connection info' }, { status: 400 });
    if (!method) return data({ error: 'Missing method' }, { status: 400 });

    const client = createFsClient(connection);

    let result: unknown;
    switch (method) {
      case 'list':
      case 'readdir':
        result = await client.readdir(path || '/');
        break;
      case 'read':
      case 'readFile': {
        const contentBuffer = await client.readFile(path);
        const decoder = new TextDecoder();
        result = decoder.decode(contentBuffer);
        break;
      }
      case 'write':
      case 'writeFile':
        if ((body as WriteRequest).args?.content === undefined) throw new Error('Missing content');
        await client.writeFile(path, (body as WriteRequest).args.content);
        result = { success: true };
        break;
      case 'delete':
        await client.unlink(path);
        result = { success: true };
        break;
      case 'stat':
        result = await client.stat(path);
        break;
      case 'ensureDir':
        await client.ensureDir(path);
        result = { success: true };
        break;
      default:
        throw new Error(`Unknown method: ${method}`);
    }

    return data({ result });
  } catch (error) {
    const err = error as Error & { response?: Response };
    console.error('FS API Error:', err);
    if (err.response) {
      const status = err.response.status;
      console.error('Upstream Response Status:', status);
      const text = await err.response.text().catch(() => 'N/A');
      console.error('Upstream Response Text:', text);

      if (status === 520) {
        return data(
          {
            error:
              'Provider Error (520): The WebDAV server refused the connection from Cloudflare. This is common with Jianguoyun blocking cloud IPs.',
          },
          { status: 502 },
        );
      }
    }
    return data({ error: err.message || 'Unknown error' }, { status: 500 });
  }
}
