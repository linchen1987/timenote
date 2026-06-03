import type { FsRootPath } from '../../types';

export type LocalFsVolume = { scheme: 'localfs' };
export type LocalFsEndpoint = LocalFsVolume & { rootPath: FsRootPath };
export type LocalFsVolumeAccess = LocalFsVolume;
export type LocalFsClientConfig = LocalFsVolume & { rootPath: FsRootPath };
