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
        this.opts.unifios = this.opts.unifios || false;


        this.userAgent = 'node.js ubnt-unifi';
        this.controller = url.parse('https://' + this.opts.host + ':' + this.opts.port);

        this.jar = rp.jar();

        this.rp = rp.defaults({
            rejectUnauthorized: !this.opts.insecure,
            jar: this.jar,
            headers: {
                'User-Agent': this.userAgent
            },
            json: true
        });

        this.autoReconnectInterval = 5 * 1000;

        this.connect();
    }

    connect(reconnect) {
        this.isClosed = false;
        return this._login(reconnect)
            .then(() => {
                return this._listen();
            });
    }

    close() {
        this.isClosed = true;
        this.ws.close();
    }

    _login(reconnect) {
        let endpointUrl = `${this.controller.href}api/login`;
        if (this.opts.unifios) {
            // unifios using one authorisation endpoint for protect and network.
            endpointUrl = `${this.controller.href}api/auth/login`;
        }

        return this.rp.post(endpointUrl, {
            resolveWithFullResponse: true,
            body: {
                username: this.opts.username,
                password: this.opts.password
            }
        }).catch(() => {
            if (!reconnect) {
                this._reconnect();
            }
        });
    }

    _listen() {
        const cookies = this.jar.getCookieString(this.controller.href);
        this.ws = new WebSocket(`wss://${this.controller.host}/wss/s/${this.opts.site}/events`, {
            perMessageDeflate: false,
            rejectUnauthorized: !this.opts.insecure,
            headers: {
                'User-Agent': this.userAgent,
                Cookie: cookies
            }
        });

        const pingpong = setInterval(() => {
            this.ws.send('ping');
        }, 15000);

        this.ws.on('open', () => {
            this.isReconnecting = false;
            this.emit('ctrl.connect');
        });

        this.ws.on('message', data => {
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

        this.ws.on('close', () => {
            this.emit('ctrl.close');
            clearInterval(pingpong);
            this._reconnect();
        });

        this.ws.on('error', err => {
            clearInterval(pingpong);
            this.emit('ctrl.error', err);
            this._reconnect();
        });
    }

    _reconnect() {
        if (!this.isReconnecting && !this.isClosed) {
            this.isReconnecting = true;
            setTimeout(() => {
                this.emit('ctrl.reconnect');
                this.isReconnecting = false;
                this.connect(true);
            }, this.autoReconnectInterval);
        }
    }

    _event(data) {
        if (data && data.key) {
            // TODO clarifiy what to do with events without key...
            const match = data.key.match(/EVT_([A-Z]{2})_(.*)/);
            if (match) {
                const [, group, event] = match;
                this.emit([group.toLowerCase(), event.toLowerCase()].join('.'), data);
            }
        }
    }

    _ensureLoggedIn() {
        return this.rp.get(`${this.controller.href}api/self`)
            .catch(() => {
                return this._login();
            });
    }

    _url(path) {
        if (this.unifios) {
            // unifios using an proxy, set extra path
            if (path.indexOf('/') === 0) {
                return `${this.controller.href}proxy/network/${path}`;
            }
            return `${this.controller.href}proxy/network/api/s/${this.opts.site}/${path}`;
        }
        else {
            if (path.indexOf('/') === 0) {
                return `${this.controller.href}${path}`;
            }
            return `${this.controller.href}api/s/${this.opts.site}/${path}`;
        }
    }

    get(path) {
        return this._ensureLoggedIn()
            .then(() => {
                return this.rp.get(this._url(path));
            });
    }

    del(path) {
        return this._ensureLoggedIn()
            .then(() => {
                return this.rp.del(this._url(path));
            });
    }

    post(path, body) {
        return this._ensureLoggedIn()
            .then(() => {
                return this.rp.post(this._url(path), {body});
            });
    }

    put(path, body) {
        return this._ensureLoggedIn()
            .then(() => {
                return this.rp.put(this._url(path), {body});
            });
    }
};
