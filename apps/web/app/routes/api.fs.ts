import { createFsClient, type FsClientConfig } from '@timenote/core';
import { type ActionFunctionArgs, data } from 'react-router';

type BaseRequest = {
  config: FsClientConfig;
  path: string;
};

type ListRequest = BaseRequest & {
  method: 'list';
  args?: never;
};

type ReadRequest = BaseRequest & {
  method: 'read';
  args?: never;
};

type WriteRequest = BaseRequest & {
  method: 'write';
  args: { content: string };
};

type RemoveRequest = BaseRequest & {
  method: 'remove';
  args?: never;
};

type ExistsRequest = BaseRequest & {
  method: 'exists';
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
  | RemoveRequest
  | ExistsRequest
  | EnsureDirRequest;

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return data({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const body = (await request.json()) as FsApiRequest;
    const { config, method, path } = body;

    if (!config) return data({ error: 'Missing config' }, { status: 400 });
    if (!method) return data({ error: 'Missing method' }, { status: 400 });

    const transport = createFsClient(config);

    let result: unknown;
    switch (method) {
      case 'list':
        result = await transport.list(path || '/');
        break;
      case 'read':
        result = await transport.read(path);
        break;
      case 'write':
        if ((body as WriteRequest).args?.content === undefined) throw new Error('Missing content');
        await transport.write(path, (body as WriteRequest).args.content);
        result = { success: true };
        break;
      case 'remove':
        await transport.remove(path);
        result = { success: true };
        break;
      case 'exists':
        result = await transport.exists(path);
        break;
      case 'ensureDir':
        await transport.ensureDir(path);
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
