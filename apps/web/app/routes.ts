import {
  index,
  layout,
  type RouteConfig,
  route,
} from '@react-router/dev/routes';

export const routes: RouteConfig = [
  layout('./routes/_shell.tsx', [
    index('./routes/home.tsx'),
    route('terms', './routes/terms.tsx'),
    route('privacy', './routes/privacy.tsx'),
    route('contact', './routes/contact.tsx'),
  ]),
  route('login', './routes/login.tsx'),
  route('signup', './routes/signup.tsx'),
];
// RR v8 requires the route config as the default export of routes.ts.
export default routes;
