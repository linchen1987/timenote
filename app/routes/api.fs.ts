import { type ActionFunctionArgs, data } from "react-router";
import { createFsClient, type FsConnection } from "~/services/fs-client";

type BaseRequest = {
  connection: FsConnection;
  path: string;
};

type ListRequest = BaseRequest & {
  method: "list" | "readdir";
  args?: never;
};

type ReadRequest = BaseRequest & {
  method: "read" | "readFile";
  args?: never;
};

type WriteRequest = BaseRequest & {
  method: "write" | "writeFile";
  args: { content: string };
};

type MkdirRequest = BaseRequest & {
  method: "mkdir";
  args?: never;
};

type DeleteRequest = BaseRequest & {
  method: "delete" | "rm" | "unlink";
  args?: never;
};

type MoveRequest = BaseRequest & {
  method: "move" | "rename";
  args: { destination: string };
};

type CopyRequest = BaseRequest & {
  method: "copy";
  args: { destination: string };
};

type StatRequest = BaseRequest & {
  method: "stat";
  args?: never;
};

type FsApiRequest = 
  | ListRequest 
  | ReadRequest 
  | WriteRequest 
  | MkdirRequest 
  | DeleteRequest 
  | MoveRequest 
  | CopyRequest 
  | StatRequest;

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return data({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const body = await request.json() as FsApiRequest;
    // @ts-ignore
    const { connection, method, path, args } = body;

    if (!connection) return data({ error: "Missing connection info" }, { status: 400 });
    if (!method) return data({ error: "Missing method" }, { status: 400 });

    const client = createFsClient(connection);

    let result;
    switch (method) {
      case "list":
      case "readdir":
        result = await client.readdir(path || "/");
        break;
      case "read":
      case "readFile":
        const contentBuffer = await client.readFile(path);
        const decoder = new TextDecoder();
        result = decoder.decode(contentBuffer);
        break;
      case "write":
      case "writeFile":
        if ((body as WriteRequest).args?.content === undefined) throw new Error("Missing content");
        await client.writeFile(path, (body as WriteRequest).args.content);
        result = { success: true };
        break;
      case "mkdir":
        await client.mkdir(path);
        result = { success: true };
        break;
      case "delete":
      case "rm":
      case "unlink":
        await client.unlink(path);
        result = { success: true };
        break;
      case "move":
      case "rename":
        if (!(body as MoveRequest).args?.destination) throw new Error("Missing destination");
        await client.rename(path, (body as MoveRequest).args.destination);
        result = { success: true };
        break;
      case "copy":
        if (!(body as CopyRequest).args?.destination) throw new Error("Missing destination");
        await client.copy(path, (body as CopyRequest).args.destination);
        result = { success: true };
        break;
      case "stat":
        result = await client.stat(path);
        break;
      default:
        throw new Error(`Unknown method: ${method}`);
    }

    return data({ result });
  } catch (error: any) {
    console.error("FS API Error:", error);
    return data({ error: error.message || "Unknown error" }, { status: 500 });
  }
}
