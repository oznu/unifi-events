'use strict'

const url = require('url')
const rp = require('request-promise')
const EventEmitter = require('events')
const WebSocket = require('@oznu/ws-connect')

module.exports = class UnifiEvents extends EventEmitter {
  constructor (opts) {
    super()

    this.opts = opts
    this.opts.site = this.opts.site || 'default'
    this.userAgent = 'UniFi Events'
    this.controller = url.parse(this.opts.controller)
    this.jar = rp.jar()
    this.rp = rp.defaults({
      rejectUnauthorized: this.opts.rejectUnauthorized,
      jar: this.jar,
      headers: {
        'User-Agent': this.userAgent
      }
    })

    // login and start listening
    if (this.opts.listen !== false) {
      this.connect()
    }

    // convenience emitters
    this.helpers = {
      'EVT_WU_Connected': 'connected',
      'EVT_WU_Disconnected': 'disconnected',
      'EVT_WG_Connected': 'connected',
      'EVT_WG_Disconnected': 'disconnected',
      'EVT_LU_CONNECTED': 'connected',
      'EVT_LU_DISCONNECTED': 'disconnected',
      'EVT_LG_CONNECTED': 'connected',
      'EVT_LG_DISCONNECTED': 'disconnected'
    }
  }

  connect (reconnect) {
    return this._login(reconnect)
      .then(() => {
        return this._listen()
      })
  }

  _login (listen) {
    return this.rp.post(`${this.controller.href}api/login`, {
      resolveWithFullResponse: true,
      json: {
        username: this.opts.username,
        password: this.opts.password,
        strict: true
      }
    })
      .then(() => {
        if (this.socket) {
        // inject new cookie into the ws handler
          this.socket.options.headers.Cookie = this.jar.getCookieString(this.controller.href)
        }
      })
      .catch((e) => {
        this.emit('websocket-status', `UniFi Events: Login Failed ${e.message}`)
      })
  }

  _listen () {
    this.socket = new WebSocket(`wss://${this.controller.host}/wss/s/${this.opts.site}/events`, {
      options: {
        perMessageDeflate: false,
        rejectUnauthorized: this.opts.rejectUnauthorized,
        headers: {
          'User-Agent': this.userAgent,
          'Cookie': this.jar.getCookieString(this.controller.href)
        }
      },
      beforeConnect: this._ensureLoggedIn.bind(this)
    })

    this.socket.on('json', (payload, flags) => {
      if ('data' in payload && Array.isArray(payload.data)) {
        payload.data.forEach((entry) => {
          this._event(entry)
        })
      }
    })

    this.socket.on('websocket-status', (status) => {
      this.emit('websocket-status', `UniFi Events: ${status}`)
    })
  }

  _event (data) {
    this.emit(data.key, data)
    this.emit('event', data)

    // send to convenience emitters
    if (data.key in this.helpers) {
      this.emit(this.helpers[data.key], data)
    }
  }

  _ensureLoggedIn () {
    return this.rp.get(`${this.controller.href}api/self`)
      .catch(() => {
        return this._login()
      })
  }

  getClients () {
    return this._ensureLoggedIn()
      .then(() => {
        return this.rp.get(`${this.controller.href}api/s/${this.opts.site}/stat/sta`, {
          json: true
        })
      })
  }

  getClient (mac) {
    return this._ensureLoggedIn()
      .then(() => {
        return this.rp.get(`${this.controller.href}api/s/${this.opts.site}/stat/user/${mac}`, {
          json: true
        })
          .then((data) => {
            return data.data[0]
          })
      })
  }

  getAp (mac) {
    return this._ensureLoggedIn()
      .then(() => {
        return this.rp.get(`${this.controller.href}api/s/${this.opts.site}/stat/device/${mac}`, {
          json: true
        })
          .then((data) => {
            return data.data[0]
          })
      })
  }

  getSites () {
    return this._ensureLoggedIn()
      .then(() => {
        return this.rp.get(`${this.controller.href}api/self/sites`, {
          json: true
        })
      })
  }
}
