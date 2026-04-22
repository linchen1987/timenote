const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

export function encodeBase58(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let x = 0n;
  for (const b of bytes) {
    x = (x << 8n) + BigInt(b);
  }
  let res = '';
  while (x > 0n) {
    res = ALPHABET[Number(x % 58n)] + res;
    x /= 58n;
  }
  for (let i = 0; i < bytes.length && bytes[i] === 0; i++) res = ALPHABET[0] + res;
  return res || ALPHABET[0];
}

export function decodeBase58(str: string): string {
  let x = 0n;
  for (const c of str) {
    const i = ALPHABET.indexOf(c);
    if (i === -1) return '';
    x = x * 58n + BigInt(i);
  }
  const res: number[] = [];
  while (x > 0n) {
    res.unshift(Number(x % 256n));
    x /= 256n;
  }
  for (let i = 0; i < str.length && str[i] === ALPHABET[0]; i++) res.unshift(0);
  return new TextDecoder().decode(new Uint8Array(res));
}

export function createNotebookToken(id: string, name: string): string {
  return `${id}_${encodeBase58(name)}`;
}

export function parseNotebookId(token: string): string {
  if (!token) return '';
  const lastUnderscoreIndex = token.lastIndexOf('_');
  if (lastUnderscoreIndex === -1) return token;
  return token.substring(0, lastUnderscoreIndex);
}

export function parseNotebookName(token: string): string {
  if (!token) return '';
  const lastUnderscoreIndex = token.lastIndexOf('_');
  if (lastUnderscoreIndex === -1) return '';
  const encodedName = token.substring(lastUnderscoreIndex + 1);
  return decodeBase58(encodedName);
}
