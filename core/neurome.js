import {matchRoute} from '../utils/match-route.js';
export class NeuromeJS {
  constructor() {
    this.version = null;
    this.routes = null;
    this.env = null;
    this.matchRoute = matchRoute;
  }

  async load() {
    const basePath = '/';
    const [{ routes }, { version }, { env }] = await Promise.all([
      import(basePath + 'dist/routes.js'),
      import(basePath + 'dist/version.js'),
      import(basePath + 'dist/env.js')
    ]);

    this.routes = routes;
    this.version = version;
    this.env = env;
    console.log('NeuromeJS is loaded:', this.version, this.getCurrentRouteParams());
  }

  static async getVersion() {
    if (!this.version) {
      const basePath = this.getBasePath();
      const { version } = await import(basePath + 'dist/version.js');
      this.version = version;
    }
    return this.version;
  }

  getCurrentRouteParams() {
    const url = window.location.pathname;
    const result = this.matchRoute(url, this.routes);
    return result ? result.params : null;
  }

  getEnv(key) {
    if (!this.env[key]) {
      throw new Error(`Environment variable ${key} is not defined`);
    }
    return this.env[key];
  }
}
