/**
 * application-level constants shared across the NestJS bootstrap
 * and any module that needs to reference routing conventions.
 */
export const API = {
  /**
   * global route prefix prepended to every endpoint.
   *
   * @example GET /api/
   */
  PREFIX: 'api',

  VERSION: {
    /**
     * URI segment injected between the global prefix and the route path.
     * combined with DEFAULT this produces the /api/v1/ base path.
     *
     * @example PREFIX: 'v', DEFAULT: '1' → /api/v1/
     */
    PREFIX: 'v',

    /**
     * default version assigned to controllers that do not declare
     * an explicit @Controller({ version }) decorator.
     *
     * @example @Controller({ path: 'users' }) → /api/v1/users
     */
    DEFAULT: '1',
  },
} as const;
