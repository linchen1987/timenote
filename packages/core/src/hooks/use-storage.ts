export type UseStorage = (
  key: string,
  initialValue: string,
) => readonly [string, (value: string) => void];
