"use strict"

const url = require('url')
const EventEmitter = require('eventemitter2').EventEmitter2
const https = require('https')
const WebSocket = require('ws')
const axios = require('axios')
const axiosCookieJarSupport = require('axios-cookiejar-support').default
const tough = require('tough-cookie')
axiosCookieJarSupport(axios)

module.exports = class unifiEvents extends EventEmitter {

    constructor(opts) {
        super({
            wildcard: true
        })

        this.opts = opts || {}
        this.opts.host = this.opts.host || 'unifi'
        this.opts.port = this.opts.port || 8443
        this.opts.username = this.opts.username || 'admin'
        this.opts.password = this.opts.password || 'ubnt'
        this.opts.site = this.opts.site || 'default'
        this.opts.insecure = this.opts.insecure || false

        this.controller = url.parse(`https://${opts.host}:${opts.port}`)

        this.cookieJar = new tough.CookieJar()
        this.isClosed = true
        this.autoReconnectInterval = 5 * 1000

        this.isInit = false
    }

    init() {
        return new Promise((resolve, reject) => {
            if (this.isInit) {
                resolve(true)
            } else {
                this.instance = axios.create({
                    jar: this.cookieJar,
                    withCredentials: true,
                    httpsAgent: new https.Agent({ rejectUnauthorized: false, requestCert: true, keepAlive: true })
                })
                this.instance.get(this.controller).then(response => {
                    if (response.headers['x-csrf-token']) {
                        this.xcsrftoken = response.headers['x-csrf-token']
                        this.instance.defaults.headers.common['X-CSRF-Token'] = this.xcsrftoken
                        this.unifios = true
                    } else {
                        this.unifios = false
                    }
                    // this.instance.interceptors.request.use(request => {
                    //     console.dir({ 'Starting Request': request }, { depth: null })
                    //     return request
                    // })
                    // this.instance.interceptors.response.use(response => {
                    //     console.dir({ 'Response:': response }, { depth: null })
                    //     return response
                    // })
                    this.isInit = true
                    this.connect().then((response) => {
                        resolve(true)
                    }).catch(error => {
                        reject(error)
                    })
                }).catch(error => {
                    reject(error)
                })
            }
        })
    }

    connect(reconnect) {
        return new Promise((resolve, reject) => {
            this.isClosed = false
            this._login(reconnect).then(() => {
                this._listen()
                resolve(true)
            }).catch(error => {
                reject(error)
            })
        })
    }

    close() {
        this.isClosed = true
        this.ws.site.close()
        this.ws.super.close()
        this.ws.system.close()
    }

    _login(reconnect) {
        return new Promise((resolve, reject) => {
            let endpointUrl = `${this.controller.href}api/login`
            if (this.unifios) {
                endpointUrl = `${this.controller.href}api/auth/login`
            }
            this.instance.post(endpointUrl, {
                username: this.opts.username,
                password: this.opts.password,
            }).then(() => {
                resolve(true)
            }).catch(error => {
                if (!reconnect) {
                    this._reconnect();
                }
            })
        })
    }

    _listen() {
        this.cookieJar.getCookieString(this.controller.href).then(cookies => {

            let eventsUrl = `wss://${this.controller.host}/wss/s/${this.opts.site}/events`

            if (this.unifios) {
                eventsUrl = `wss://${this.controller.host}/proxy/network/wss/s/${this.opts.site}/events`
            }

            this.ws = new WebSocket(eventsUrl, {
                perMessageDeflate: false,
                rejectUnauthorized: !this.opts.insecure,
                headers: {
                    Cookie: cookies
                }
            })

            const pingpong = setInterval(() => {
                this.ws.send('ping')
            }, 15000)

            this.ws.on('open', () => {
                this.isReconnecting = false
                this.emit('ctrl.connect')
            })

            this.ws.on('message', data => {
                if (data === 'pong') {
                    return
                }
                try {
                    const parsed = JSON.parse(data)
                    if ('data' in parsed && Array.isArray(parsed.data)) {
                        parsed.data.forEach(entry => {
                            this._event(entry)
                        })
                    }
                } catch (err) {
                    this.emit('ctrl.error', err)
                }
            })

            this.ws.on('close', () => {
                this.emit('ctrl.close')
                clearInterval(pingpong)
                this._reconnect()
            })

            this.ws.on('error', err => {
                this.emit('ctrl.error', err)
                clearInterval(pingpong)
                this._reconnect()
            })
        })
    }

    _reconnect() {
        if (!this.isReconnecting && !this.isClosed) {
            this.isReconnecting = true
            setTimeout(() => {
                this.emit('ctrl.reconnect')
                this.isReconnecting = false
                this.connect(true).catch(error => {
                    console.dir('_reconnect() encountered an error')
                })
            }, this.autoReconnectInterval)
        }
    }

    _event(data) {
        if (data && data.key) {
            // TODO clarifiy what to do with events without key...
            const match = data.key.match(/EVT_([A-Z]{2})_(.*)/)
            if (match) {
                const [, group, event] = match
                this.emit([group.toLowerCase(), event.toLowerCase()].join('.'), data)
            }
        }
    }

    _ensureLoggedIn() {
        return new Promise((resolve, reject) => {
            this.instance.get(`${this.controller.href}api/${this.unifios ? 'users/' : ''}self`).then(() => {
                resolve(true)
            }).catch(() => {
                this._login().then(() => {
                    resolve(true)
                }).catch(error => {
                    reject(error)
                })
            })
        })
    }

    _url(path) {
        if (this.unifios) {
            if (path.indexOf('/') === 0) {
                return `${this.controller.href}proxy/network/${path}`
            }
            return `${this.controller.href}proxy/network/api/s/${this.opts.site}/${path}`
        }
        else {
            if (path.indexOf('/') === 0) {
                return `${this.controller.href}${path}`
            }
            return `${this.controller.href}api/s/${this.opts.site}/${path}`
        }
    }

    get(path) {
        return new Promise((resolve, reject) => {
            this._ensureLoggedIn().then(() => {
                this.instance.get(this._url(path)).then(response => {
                    resolve(response.data)
                }).catch(error => {
                    reject(error)
                })
            }).catch(error => {
                reject(error)
            })
        })
    }

    del(path) {
        return new Promise((resolve, reject) => {
            this._ensureLoggedIn().then(() => {
                this.instance.del(this._url(path)).then(response => {
                    resolve(response.data)
                }).catch(error => {
                    reject(error)
                })
            }).catch(error => {
                reject(error)
            })
        })
    }

    post(path, body) {
        return new Promise((resolve, reject) => {
            this._ensureLoggedIn().then(() => {
                this.instance.post(this._url(path), body).then(response => {
                    resolve(response.data)
                }).catch(error => {
                    reject(error)
                })
            }).catch(error => {
                reject(error)
            })
        })
    }

    put(path, body) {
        return new Promise((resolve, reject) => {
            this._ensureLoggedIn().then(() => {
                this.instance.put(this._url(path), body).then(response => {
                    resolve(response.data)
                }).catch(error => {
                    reject(error)
                })
            }).catch(error => {
                reject(error)
            })
        })
    }
}
