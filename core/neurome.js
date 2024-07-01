import { cabin as _cabin } from '../utils/cabin.js'
import { matchRoute } from '../utils/match-route.js'

export class NeuromeJS {
  constructor() {
    this.version = null
    this.routes = null
    this.env = null
    this.matchRoute = matchRoute
  }

  cabin(element, data) {
    const html = _cabin(element, data)
    element.innerHTML = html
    this.populate(element)
  }

  async load() {
    const basePath = '/'
    const [{ routes }, { version }, { env }] = await Promise.all([
      import(basePath + 'dist/routes.js'),
      import(basePath + 'dist/version.js'),
      import(basePath + 'dist/env.js'),
    ])

    this.routes = routes
    this.version = version
    this.env = env
    console.log('🔋 NeuromeJS is loaded:', this.version)

    // Charger et injecter la page initiale
    await this.loadAndInjectPage()
  }

  static async getVersion() {
    if (!this.version) {
      const basePath = this.getBasePath()
      const { version } = await import(basePath + 'dist/version.js')
      this.version = version
    }
    return this.version
  }

  getCurrentRouteParams() {
    const url = window.location.pathname
    const result = this.matchRoute(url, this.routes)
    return result ? result.params : null
  }

  getEnv(key) {
    if (!this.env[key]) {
      throw new Error(`Environment variable ${key} is not defined`)
    }
    return this.env[key]
  }

  async loadAndInjectPage() {
    const url = window.location.pathname
    const result = this.matchRoute(url, this.routes)

    if (result) {
      const pagePath = result.component
      const pageContent = await this.loadPage(pagePath)
      document.getElementById('app').innerHTML = pageContent
      this.populate()
    } else {
      document.getElementById('app').innerHTML = '<h1>404 Not Found</h1>'
    }
  }

  async loadPage(pageModulePath) {
    const { default: pageContent } = await import(pageModulePath)
    return pageContent
  }

  sanitizeElement(element) {
    const scripts = element.querySelectorAll('script')
    scripts.forEach((script) => script.remove())

    const allElements = element.querySelectorAll('*')
    allElements.forEach((el) => {
      ;[...el.attributes].forEach((attr) => {
        const regex = /<script|<ifr|<em|<img|javascript:/i.test(attr.value)
        if (attr.name.startsWith('on') || regex) {
          console.warn(
            `Attribute ${attr.name} removed from element ${el.tagName}, possible XSS.`
          )
          el.removeAttribute(attr.name)
        }
      })
    })
    return element
  }

  async handleAttachMethods(container, middlewares, ctrl, state) {
    const middlewaresMethods = Object.keys(middlewares)
      .filter((k) => k.startsWith('on'))
      .filter((k) => !k.match(/state|oninit|cleanup/i))
    const ctrlMethods = Object.keys(ctrl)
      .filter((k) => k.startsWith('on'))
      .filter((k) => !k.match(/state|oninit|cleanup/i))

    if (middlewares.render || ctrl.render) {
      container.render = async (proxy_) => {
        const proxy = proxy_ || {
          name: undefined,
          key: undefined,
          value: undefined,
        }
        const middlewareResult = middlewares.render
          ? await middlewares.render(state, container, proxy)
          : undefined
        if (ctrl.render) {
          ctrl.render(state, container, proxy, middlewareResult)
        }
      }
    }

    if (middlewares.onInit || ctrl.onInit) {
      container.onInit = async () => {
        const middlewareResult = middlewares.onInit
          ? await middlewares.onInit(state, container)
          : undefined

        if (ctrl.onInit) ctrl.onInit(state, container, middlewareResult)
      }
    }

    if (middlewares.cleanUp || ctrl.cleanUp) {
      container.cleanUp = () => {
        const middlewareResult = middlewares.cleanUp
          ? middlewares.cleanUp(state, container)
          : undefined
        if (ctrl.cleanUp) ctrl.cleanUp(state, container, middlewareResult)

        this.cleanupCollection.push(container.cleanUp)
      }
    }

    const mergedMethods = [...middlewaresMethods, ...ctrlMethods]
    mergedMethods.forEach((method) => {
      const methodType = method.slice(2).toLocaleLowerCase()

      const helper = async (e) => {
        const middlewareResult = middlewares[method]
          ? await middlewares[method](state, e.target, e)
          : undefined
        if (ctrl[method]) ctrl[method](state, e.target, e, middlewareResult)
      }

      container._listeners[methodType] = helper
      container.addEventListener(methodType, helper)
    })

    // Call onInit method and populate the container for nested controllers
    if (container?.onInit) await container?.onInit()
  }

  async populate(el = document) {
    const elements = el.querySelectorAll('[n-c], [n-m], [n-v]')

    for (const element of elements) {
      element._listeners = {}
      const state = []
      const ctrl = {}
      const middlewares = {}

      // === State management ===
      for (const attr of element.getAttributeNames()) {
        const attrValue = element.getAttribute(attr)

        if (attr.startsWith('n-s-')) {
          state.push({ [attr.slice(4)]: attrValue })
          element.removeAttribute(attr)
        }
      }

      // === Controller and Middleware management ===
      if (element.getAttribute('n-c')) {
        const controllerName = element.getAttribute('n-c')
        const controllerModulePath = `/ctrl/${controllerName}.js`
        try {
          const { default: controller } = await import(controllerModulePath)
          if (controller.state) {
            state.push(
              ...Object.keys(controller.state).map((k) => ({
                [k]: controller.state[k],
              }))
            )
          }
          Object.assign(ctrl, controller)
          element.removeAttribute('n-c')
        } catch (e) {
          console.error(`Controller ${controllerName} not found`)
        }
      }

      if (element.getAttribute('n-m')) {
        const middlewareName = element.getAttribute('n-c')
        const middlewareModulePath = `/ctrl/${middlewareName}.js`
        try {
          const { default: middleware } = await import(middlewareModulePath)
          if (middleware.state) {
            state.push(
              ...Object.keys(middleware.state).map((k) => ({
                [k]: middleware.state[k],
              }))
            )
          }

          Object.assign(middlewares, middleware)
          element.removeAttribute('n-m')
        } catch (e) {
          console.error(`Middleware ${controllerName} not found`)
        }
      }

      await this.injectView(element)

      this.handleAttachMethods(
        element,
        middlewares,
        ctrl,
        state.reduce((acc, curr) => {
          return { ...acc, ...curr }
        }, {})
      )
    }
  }

  async injectView(element) {
    if (element.getAttribute('n-v')) {
      const viewName = element.getAttribute('n-v')
      const viewModulePath = `/dist/views/${viewName}.js`
      try {
        const { default: view } = await import(viewModulePath)

        const container = document.createElement('div')
        container.innerHTML = view
        element.replaceWith(container?.firstElementChild || container)
        element.removeAttribute('n-v')
      } catch (e) {
        console.error(`View ${viewName} not found`)
      }
      this.populate()
    }
  }
}
