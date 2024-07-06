import { cabin as _cabin } from '../utils/cabin.js'
import { matchRoute } from '../utils/match-route.js'
import { IdbORM } from '../idb/idb.js'
import { Model } from '../idb/model.js'

export class NeuromeJS {
  /**
   * @param {Object} options
   * @param {boolean} options.style
   * @param {string} options.locale
   * @param {string} options.cookieConsentKey
   * @param {string} options.dbName
   * @param {Array} options.stores
   * @param {number} options.dbVersion
   * @param {Object} options.routes
   */
  constructor({
    style = true,
    locale = 'en',
    cookieConsentKey = 'cookieConsent',
    dbName = 'neurome',
    stores,
    dbVersion = 1,
  } = {}) {
    this.version = null

    //Routing
    this.routes = null
    this.env = null
    this.matchRoute = matchRoute

    //I18n
    this.locale = locale
    this.translations = {}
    this.loadTranslations()

    //Styling
    this.style = style

    this.cleanupCollection = []

    //Cookie
    this.cookieConsentKey = cookieConsentKey
    //IDB
    this.stores = stores
    this.dbName = dbName
    this.db = new IdbORM(dbName, dbVersion)
    this.models = {}
  }

  checkCookieConsent() {
    return document.cookie.includes(`${this.cookieConsentKey}=true`)
  }

  async setCookieConsent(consent) {
    document.cookie = `${this.cookieConsentKey}=${consent};path=/;max-age=31536000`
    await this.initDatabase()
  }

  setLocale(locale) {
    if (this.locale !== locale) {
      this.locale = locale
      this.loadTranslations().then(() => {
        this.refreshContent()
      })
    }
  }

  async initDatabase(stores) {
    await this.db.init(stores)
    this.createModels(stores)
  }

  createModels(stores) {
    stores.forEach((store) => {
      this.models[store.name] = new Model(this.db, store.name)
    })
  }

  async loadTranslations() {
    try {
      const l = await import(`/dist/locales/${this.locale}.js`)
      this.translations = l.default
      console.log(`Translations loaded for locale: ${this.locale}`)
    } catch (e) {
      console.error(`Error loading translations for locale: ${this.locale}`, e)
    }
  }

  t(key) {
    return this.translations[key] || key
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

    if (this.style) {
      const rel = document.createElement('link')
      rel.rel = 'stylesheet'
      rel.href = '/dist/styles.css'
      document.head.prepend(rel)
    }

    if (this.stores && this.checkCookieConsent())
      await this.initDatabase(this.stores)

    await this.loadAndInjectPage()
  }

  cabin(element, data) {
    const cloneView = element.view.cloneNode(true)

    const oldElements = []
    element.querySelectorAll('[n-id]').forEach((el) => {
      if (el.state) {
        oldElements.push({
          id: el.getAttribute('n-id'),
          state: el.state,
        })
      }
    })

    this.populateAttributes(cloneView, data)

    const html = _cabin(
      cloneView,
      Object.keys(data).reduce((acc, key) => {
        return {
          ...acc,
          [key]: this.t(data[key]),
        }
      }, {}) || {}
    )

    element.innerHTML = html

    this.populate(element, oldElements)
  }

  populateAttributes(element, data) {
    element.querySelectorAll('[n-s-]').forEach((el) => {
      const attrNames = el.getAttributeNames()
      attrNames.forEach((attr) => {
        if (attr.startsWith('n-s-')) {
          const key = attr.slice(4)
          el.setAttribute(attr, data[key] || '')
        }
      })
    })
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

  async handleAttachMethods(container, middlewares, ctrl) {
    const middlewaresMethods = Object.keys(middlewares)
      .filter((k) => k.startsWith('on'))
      .filter((k) => !k.match(/state|oninit|onpulse|cleanup/i))
    const ctrlMethods = Object.keys(ctrl)
      .filter((k) => k.startsWith('on'))
      .filter((k) => !k.match(/state|oninit|onpulse|cleanup/i))

    if (middlewares.onInit || ctrl.onInit) {
      container.onInit = async () => {
        const middlewareResult = middlewares.onInit
          ? await middlewares.onInit(container)
          : undefined

        if (ctrl.onInit) ctrl.onInit(container, middlewareResult)
      }
    }

    if (middlewares.cleanUp || ctrl.cleanUp) {
      container.cleanUp = () => {
        const middlewareResult = middlewares.cleanUp
          ? middlewares.cleanUp(container)
          : undefined
        if (ctrl.cleanUp) ctrl.cleanUp(container, middlewareResult)

        this.cleanupCollection.push(container.cleanUp)
      }
    }

    if (middlewares.onPulse || ctrl.onPulse) {
      container.onPulse = async (el, message) => {
        const middlewareResult = middlewares.onPulse
          ? await middlewares.onPulse(el, message)
          : undefined
        if (ctrl.onPulse) ctrl.onPulse(el, message, middlewareResult)
      }
    }

    const mergedMethods = [...middlewaresMethods, ...ctrlMethods]
    mergedMethods.forEach((method) => {
      const methodType = method.slice(2).toLocaleLowerCase()

      const helper = async (e) => {
        const middlewareResult = middlewares[method]
          ? await middlewares[method](e.target, e)
          : undefined
        if (ctrl[method]) ctrl[method](e.target, e, middlewareResult)
      }

      container._listeners = container._listeners || {}
      container._listeners[methodType] = helper
      container.addEventListener(methodType, helper)
    })

    if (container?.onInit) await container?.onInit()
  }

  hashString(str) {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash |= 0 // Convert to 32bit integer
    }

    return hash.toString().slice(1)
  }

  async populate(el = document, oldElements = []) {
    const elements = el.querySelectorAll('[n-c], [n-m], [n-v]')

    elements.forEach((el, index) => {
      if (!el.getAttribute('n-id')) {
        const attributes = [...el.attributes]
          .map((attr) => `${attr.name}=${attr.value}`)
          .join('|')
        el.setAttribute('n-id', this.hashString(attributes + '-' + index))
      }
    })

    elements.forEach((el) => {
      el.view = el.cloneNode(true)
    })

    for (const element of elements) {
      element._listeners = {}
      const state = []
      const ctrl = {}
      const middlewares = {}

      for (const attr of element.getAttributeNames()) {
        const attrValue = element.getAttribute(attr)

        if (attr.startsWith('n-s-')) {
          state.push({ [attr.slice(4)]: attrValue })
          element.removeAttribute(attr)
        }
      }

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

      const existState = oldElements.find(
        (el) => el.id === element.getAttribute('n-id')
      )

      if (existState) {
        element.state = {
          ...state.reduce((acc, curr) => ({ ...acc, ...curr }), {}),
          ...existState.state,
        }
      } else {
        element.state = {
          ...state.reduce((acc, curr) => ({ ...acc, ...curr }), {}),
        }
      }

      await this.injectView(element, oldElements)
      if (!element.__init) this.handleAttachMethods(element, middlewares, ctrl)
      element.__init = true
    }
  }

  async injectView(element, oldElements = []) {
    if (element.getAttribute('n-v')) {
      const viewName = element.getAttribute('n-v')
      const viewModulePath = `/dist/views/${viewName}.js`
      try {
        const { default: view } = await import(viewModulePath)

        const id = element.getAttribute('n-id')
        const container = document.createElement('div')
        container.innerHTML = view

        if (container.firstElementChild) {
          container.firstElementChild.setAttribute('n-id', id)
        } else {
          container.setAttribute('n-id', id)
        }
        element.replaceWith(container?.firstElementChild || container)
        element.removeAttribute('n-v')
      } catch (e) {
        console.error(`View ${viewName} not found`)
      }
      this.populate(undefined, oldElements)
    }
  }

  pulse(room, message) {
    const elements = document.querySelectorAll(`[n-l-${room}]`)
    elements.forEach((element) => {
      if (element.onPulse) element.onPulse(element, { room, message })
    })
  }

  refreshContent() {
    const app = document.getElementById('app')
    const html = app.innerHTML
    app.innerHTML = this.t(html)
    this.populate(app)
  }
}
