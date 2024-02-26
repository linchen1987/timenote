import type { Request, Response } from 'express';
import type { Space } from '@timenote/core';

interface CustomRequest extends Request {
  rootDir?: string;
  space?: Space;
}

interface CustomResponse extends Response {}

export { CustomRequest as Request };
export { CustomResponse as Response };

export type ServiceOptions = {
  rootDir: string;
};
