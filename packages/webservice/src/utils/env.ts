import { BLOCKLET_DID } from './constants';

function safeJsonParse(input: string, defaultValue: any[] = []) {
  try {
    return JSON.parse(input);
  } catch {
    return defaultValue;
  }
}

let serviceMountPoint = '';

if (process.env.BLOCKLET_MOUNT_POINTS) {
  console.log('BLOCKLET_MOUNT_POINTS', process.env.BLOCKLET_MOUNT_POINTS);
  const mountPoints = safeJsonParse(process.env.BLOCKLET_MOUNT_POINTS);
  const component = mountPoints.find(
    (x: { did: string; mountPoint: string }) => x.did === BLOCKLET_DID
  );
  if (component) {
    serviceMountPoint = (component.mountPoint || '').replace(/\/$/, '');
  }
}

export default {
  serviceMountPoint,
};
