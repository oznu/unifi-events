# ubnt-unifi 

[![NPM version](https://badge.fury.io/js/ubnt-unifi.svg)](http://badge.fury.io/js/ubnt-unifi)
[![Dependency Status](https://img.shields.io/gemnasium/hobbyquaker/ubnt-unifi.svg?maxAge=2592000)](https://gemnasium.com/github.com/hobbyquaker/ubnt-unifi)
[![Build Status](https://travis-ci.org/hobbyquaker/ubnt-unifi.svg?branch=master)](https://travis-ci.org/hobbyquaker/ubnt-unifi)
[![XO code style](https://img.shields.io/badge/code_style-XO-5ed9c7.svg)](https://github.com/sindresorhus/xo)
[![License][mit-badge]][mit-url]

> ubnt-unifi is a Node.js module that allows you to listen for events from and call methods on the UniFi API (Ubiquiti 
Wifi).

## Requirements

* Node.js v6 or later
* [UniFi-Controller](https://www.ubnt.com/download/unifi) v5

## Installation

unifi can be installed using the following npm command:

`$ npm install unifi`


## Example

```javascript
const Unifi = require('ubnt-unifi')

let unifi = new Unifi({
  controller: 'https://demo.ubnt.com',  // Required. The url of the UniFi Controller
  username: 'superadmin',               // Required.
  password: 'password',                 // Required.
  site: 'default',                      // Optional. The UniFi site to connect to, if not set will use the default site.
  rejectUnauthorized: true,             // Optional. Set to false if you don't have a valid SSL
  listen: true                          // Optional. Set to false if you don't want to listen for events
})

// Listen for users and guests connecting to the network
unifi.on('connected', (data) => {
  console.log(data)
})

// Listen for users and guests disconnecting from the network
unifi.on('disconnected', (data) => {
  console.log(data)
})

// Listen for any event
unifi.on('event', (data) => {
  console.log(data)
})
```

## Events

ubnt-unifi uses [EventEmitter2]() and namespaced events. 

### namespace unifi

These events indicate the status of the connection to the unifi controller

* `unifi.connect` - emitted when the connection to the controller is established
* `unifi.disconnect` - emitted when the connection to the controller is lost
* `unifi.error` - 
* `unifi.reconnect` - 

### namespaces `wu`, `wg`, `lu`, ...

This JSON file shows all possible events: https://demo.ubnt.com/manage/locales/en/eventStrings.json?v=5.4.11.2
The prefix `EVT_` gets stripped, the first underscore is replaced by the namespace separating dot, everything is 
converted to lower case. Some events such as ```EVT_AD_LOGIN``` (Admin Login) are not emitted by the UniFi Controller.

#### Example Wireless User events

* `wu.connected` - Wireless User connected
* `wu.disconnected` - Wireless User disconnected
* `wu.roam` - Wireless User roamed from one AP to another
* `wu.roam_radio` - Wireless User changed channel on the same AP

#### Example Wireless Guest Events

* `wg.connected` - Wireless Guest connected
* `wg.disconnected` - Wireless Guest disconnected
* `wg.roam` - Wireless Guest roamed from one AP to another
* `wg.roam_radio` - Wireless Guest changed channel on the same AP
* `wg.authorization_ended` - Wireless Guest became unauthorised

#### Wildcard usage

Example listing for events on Guest Wireless networks only:

```javascript
unifi.on('wg.*', function (data) {
  console.log(this.event, data)
})
```

Example listening for connected events on all network types:

```javascript
unifi.on('*.connected', function (data) {
  console.log(this.event, data)
})
```


## Methods

#### getSites()

#### getSitesStats()

#### getClients()

#### getClient(mac)

#### getApi(path)

#### delApi(path)

#### postApi(body)


## License

MIT © 2018 [Sebastian Raff](https://github.com/hobbyquaker)    
MIT © 2017-2018 [oznu](https://github.com/oznu)

[mit-badge]: https://img.shields.io/badge/License-MIT-blue.svg?style=flat
[mit-url]: LICENSE
