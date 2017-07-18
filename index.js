'use strict'

const url = require('url')
const WebSocket = require('ws')
const EventEmitter = require('events')
const rp = require('request-promise')

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
      this._login()
        .then(() => {
          return this._listen()
        })
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

  _login () {
    return this.rp.post(`${this.controller.href}api/login`, {
      resolveWithFullResponse: true,
      json: {
        username: this.opts.username,
        password: this.opts.password,
        strict: true
      }
    })
  }

  _listen () {
    let cookies = this.jar.getCookieString(this.controller.href)
    const ws = new WebSocket(`wss://${this.controller.host}/wss/s/${this.opts.site}/events`, {
      perMessageDeflate: false,
      rejectUnauthorized: this.opts.rejectUnauthorized,
      headers: {
        'User-Agent': this.userAgent,
        'Cookie': cookies
      }
    })

    ws.on('open', () => {
      this.emit('ready')
    })

    ws.on('message', (data, flags) => {
      if (data === 'pong') { return }
      try {
        let parsed = JSON.parse(data)
        if ('data' in parsed && Array.isArray(parsed.data)) {
          parsed.data.forEach((entry) => {
            this._event(entry)
          })
        }
      } catch (e) {
        console.error('Failed to parse event.')
        console.error(data)
      }
    })

    // Ping the server every 15 seconds to keep the connection alive.
    setInterval(() => {
      ws.send('ping')
    }, 15000)
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

  getSites () {
    return this._ensureLoggedIn()
      .then(() => {
        return this.rp.get(`${this.controller.href}api/self/sites`, {
          json: true
        })
      })
  }

}
