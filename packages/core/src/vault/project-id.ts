import { customAlphabet } from 'nanoid';

const ALPHANUMERIC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const nanoidAlphanum = customAlphabet(ALPHANUMERIC, 11);

export function generateProjectId(): string {
  return `v${nanoidAlphanum()}`;
}
