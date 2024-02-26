import dayjs from 'dayjs';

export function formatDateTime(date: Date | string): string {
  return dayjs(date).format('YYYY-MM-DD HH:mm:ss');
}

export const PREFIX = (window?.blocklet?.prefix || '').replace(/\/$/, '');

const isPWA = window.matchMedia('(display-mode: standalone)').matches;

export { isPWA };
