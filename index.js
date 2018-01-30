/* eslint-disable camelcase */

const url = require('url');
const EventEmitter = require('eventemitter2').EventEmitter2;
const WebSocket = require('ws');
const rp = require('request-promise');

module.exports = class UnifiEvents extends EventEmitter {

    constructor(opts) {
        super({
            wildcard: true
        });

        this.opts = opts || {};
        this.opts.host = this.opts.host || 'unifi';
        this.opts.port = this.opts.port || 8443;
        this.opts.username = this.opts.username || 'admin';
        this.opts.password = this.opts.password || 'ubnt';
        this.opts.site = this.opts.site || 'default';

        this.userAgent = 'node.js ubnt-unifi';
        this.controller = url.parse('https://' + this.opts.host + ':' + this.opts.port);

        this.jar = rp.jar();

        this.rp = rp.defaults({
            rejectUnauthorized: !!this.opts.insecure,
            jar: this.jar,
            headers: {
                'User-Agent': this.userAgent
            }
        });

        this.autoReconnectInterval = 5 * 1000;

        this.connect();
    }

    connect(reconnect) {
        return this._login(reconnect)
      .then(() => {
          return this._listen();
      });
    }

    close() {

    }

    _login(reconnect) {
        return this.rp.post(`${this.controller.href}api/login`, {
            resolveWithFullResponse: true,
            json: {
                username: this.opts.username,
                password: this.opts.password,
                strict: true
            }
        })
    .catch(() => {
        if (!reconnect) {
            this._reconnect();
        }
    });
    }

    _listen() {
        const cookies = this.jar.getCookieString(this.controller.href);
        const ws = new WebSocket(`wss://${this.controller.host}/wss/s/${this.opts.site}/events`, {
            perMessageDeflate: false,
            rejectUnauthorized: this.opts.rejectUnauthorized,
            headers: {
                'User-Agent': this.userAgent,
                Cookie: cookies
            }
        });

    // Ping the server every 15 seconds to keep the connection alive.
        const pingpong = setInterval(() => {
            ws.send('ping');
        }, 15000);

        ws.on('open', () => {
            this.reconnecting = false;
            this.emit('ctrl.connect');
        });

        ws.on('message', data => {
            if (data === 'pong') {
                return;
            }
            try {
                const parsed = JSON.parse(data);
                if ('data' in parsed && Array.isArray(parsed.data)) {
                    parsed.data.forEach(entry => {
                        this._event(entry);
                    });
                }
            } catch (err) {
                this.emit('ctrl.error', err);
            }
        });

        ws.on('close', e => {
            clearInterval(pingpong);
            this._reconnect(e);
        });

        ws.on('error', err => {
            clearInterval(pingpong);
            this.emit('ctrl.error', err);
            this._reconnect();
        });
    }

    _reconnect() {
        if (!this.reconnecting) {
            this.emit('ctrl.disconnect');
            this.reconnecting = true;
            setTimeout(() => {
                this.emit('ctrl.reconnect');
                this.reconnecting = false;
                this.connect(true);
            }, this.autoReconnectInterval);
        }
    }

    _event(data) {
        const match = data.key.match(/EVT_([A-Z]{2})_(.*)/);
        if (match) {
            const [, group, event] = match;
            this.emit([group.toLowerCase(), event.toLowerCase()].join('.'), data);
        }
    }

    _ensureLoggedIn() {
        return this.rp.get(`${this.controller.href}api/self`)
      .catch(() => {
          return this._login();
      });
    }

    get(path) {
        return this._ensureLoggedIn()
      .then(() => {
          return this.rp.get(`${this.controller.href}api/s/${this.opts.site}/${path}`, {
              json: true
          });
      });
    }

    del(path) {
        return this._ensureLoggedIn()
      .then(() => {
          return this.rp.del(`${this.controller.href}api/s/${this.opts.site}/${path}`, {
              json: true
          });
      });
    }

    post(path, body) {
        return this._ensureLoggedIn()
      .then(() => {
          return this.rp.post(`${this.controller.href}api/s/${this.opts.site}/${path}`, {
              body,
              json: true
          });
      });
    }
};
