import { index, type RouteConfig } from '@react-router/dev/routes';

export const routes: RouteConfig = [index('./routes/home.tsx')];
// RR v8 requires the route config as the default export of routes.ts.
export default routes;
