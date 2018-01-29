# UniFi 

UniFi is a Node.js module that allows you to listen for events from and call methods on the UniFi API (Ubquiti Wifi).

## Requirements

* Node.js v6 or later
* [UniFi-Controller](https://www.ubnt.com/download/unifi) v5

## Installation

unifi can be installed using the following npm command:

```
npm install unifi
```


## Example

```javascript
const Unifi = require('unifi')

let unifi = new UnifiEvents({
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

In addition to the ```connect```, ```disconnect``` and ```event``` event types, other UniFi event types are emitted using the UniFi Event Key ID.

This JSON file shows all possible events: https://demo.ubnt.com/manage/locales/en/eventStrings.json?v=5.4.11.2

Some events such as ```EVT_AD_LOGIN``` (Admin Login) are not emitted by the UniFi Controller.

Wireless User Events:

* ```EVT_WU_Connected``` - Wireless User connected
* ```EVT_WU_Disconnected``` - Wireless User disconnected
* ```EVT_WU_ROAM``` - Wireless User roamed from one AP to another
* ```EVT_WU_ROAM_RADIO``` - Wireless User changed channel on the same AP

Wireless Guest Events:

* ```EVT_WG_Connected``` - Wireless Guest connected
* ```EVT_WG_Disconnected``` - Wireless Guest disconnected
* ```EVT_WG_ROAM``` - Wireless Guest roamed from one AP to another
* ```EVT_WG_ROAM_RADIO``` - Wireless Guest changed channel on the same AP
* ```EVT_WG_AUTHORIZATION_ENDED``` - Wireless Guest became unauthorised

LAN User Events:

* ```EVT_LU_CONNECTED``` - LAN User connected to the network
* ```EVT_LU_DISCONNECTED``` - LAN User disconnected from the network

LAN Guest Events:

* ```EVT_LG_CONNECTED``` - LAN Guest connected to the network
* ```EVT_LG_DISCONNECTED``` - LAN Guest disconnected from the network

Example listing for connections made to Guest Wireless networks only:

```javascript
unifi.on('EVT_WG_Connected', (data) => {
  console.log(data)
})
```


### Websocket status events

Events indicating the status of the connection to the Unifi controller are emitted on `websocket-status`. Example
Payloads:

* `UniFi Events: error - ...`
* `UniFi Events: disconnected`
* `UniFi Events: reconnecting...`
* `UniFi Events: Connected to ...`
* `UniFi Events: Failed to parse message.`



## Methods

#### getSites()

#### getSitesStats()

#### getClients()

#### getClient(mac)

#### getApi(path)

#### delApi(path)

#### postApi(body)
