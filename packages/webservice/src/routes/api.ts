import { Router } from 'express';

import initV1 from './v1';
import { ServiceOptions } from '../types';

const router: Router = Router();

const initApiRoutes = (options: ServiceOptions): Router => {
  router.use('/v1', initV1(options));

  return router;
};

export default initApiRoutes;
