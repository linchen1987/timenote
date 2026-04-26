import { customAlphabet, nanoid } from 'nanoid';
import { type NoteId, NoteIdSchema, type VolumeName, VolumeNameSchema } from './types';

const VOLUME_RE = /^[0-9]{4}-[0-9]{2}$/;
const NOTE_FILENAME_RE = /^[0-9]{8}-[0-9]{6}-[0-9]{4}\.[a-zA-Z0-9]+$/;

export function generateNoteId(date?: Date): NoteId {
  const d = date ?? new Date();
  const pad = (n: number, len: number) => n.toString().padStart(len, '0');

  const yyyy = pad(d.getUTCFullYear(), 4);
  const MM = pad(d.getUTCMonth() + 1, 2);
  const dd = pad(d.getUTCDate(), 2);
  const HH = pad(d.getUTCHours(), 2);
  const mm = pad(d.getUTCMinutes(), 2);
  const ss = pad(d.getUTCSeconds(), 2);
  const SSS = pad(d.getUTCMilliseconds(), 3);
  const R = Math.floor(Math.random() * 10).toString();

  return `${yyyy}${MM}${dd}-${HH}${mm}${ss}-${SSS}${R}`;
}

export function isValidNoteId(id: string): id is NoteId {
  return NoteIdSchema.safeParse(id).success;
}

export function noteIdFromFilename(filename: string): string | null {
  const match = filename.match(/^([0-9]{8}-[0-9]{6}-[0-9]{4})\.[a-zA-Z0-9]+$/);
  return match ? match[1] : null;
}

export function filenameFromNoteId(noteId: string, ext = 'md'): string {
  return `${noteId}.${ext}`;
}

export function volumeNameFromDate(isoDate: string): VolumeName {
  const match = isoDate.match(/^(\d{4}-\d{2})/);
  if (!match) throw new Error(`Invalid ISO date for volume extraction: ${isoDate}`);
  const vol = match[1];
  if (!VolumeNameSchema.safeParse(vol).success) {
    throw new Error(`Invalid volume name: ${vol}`);
  }
  return vol as VolumeName;
}

export function volumeNameFromNoteId(noteId: NoteId): string {
  const yyyy = noteId.slice(0, 4);
  const mm = noteId.slice(4, 6);
  return `${yyyy}-${mm}`;
}

export function isValidNoteFilename(filename: string): boolean {
  return NOTE_FILENAME_RE.test(filename);
}

export function isValidVolumeName(name: string): name is VolumeName {
  return VOLUME_RE.test(name) && VolumeNameSchema.safeParse(name).success;
}

const ALPHANUMERIC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const nanoidAlphanum = customAlphabet(ALPHANUMERIC, 11);

export function generateProjectId(): string {
  return nanoidAlphanum();
}

export function noteIdToUrl(noteId: string): string {
  return noteId.replaceAll('-', '');
}

export function noteIdFromUrl(urlId: string): NoteId {
  if (urlId.includes('-')) return urlId as NoteId;
  return urlId.replace(/(.{8})(.{6})(.{4})/, '$1-$2-$3') as NoteId;
}

export function isNoteIdUrl(urlId: string): boolean {
  const normalized = urlId.includes('-') ? urlId : urlId.replace(/(.{8})(.{6})(.{4})/, '$1-$2-$3');
  return NoteIdSchema.safeParse(normalized).success;
}

export function notePath(noteId: NoteId, ext = 'md'): string {
  const vol = volumeNameFromNoteId(noteId);
  return `${vol}/${noteId}.${ext}`;
}
