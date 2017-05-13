'use strict'

/*
 * Send notifications to a Slack channel when devices connect or disconnect from the UniFi network.
 * Setup an incoming webhook using slack: https://my.slack.com/services/new/incoming-webhook/
 */

const rp = require('request-promise')
const UnifiEvents = require('../')

// Enter the webhook url provided by Slack here
let webhook = 'https://hooks.slack.com/services/xxxxxxxxx/xxxxxxxxxx/xxxxxxxxxxxxxxxx'

let sendNotification = (text) => {
  return rp.post(webhook, {
    json: {
      text: text,
      username: 'UniFi Notify'
    }
  })
  .then(() => {
    console.log(text)
  })
  .catch((err) => {
    console.log(err)
  })
}

let unifi = new UnifiEvents({
  controller: 'https://demo.ubnt.com',
  username: 'superadmin',
  password: 'password'
})

unifi.on('ready', () => {
  console.log('Connected To UniFi Controller')
})

unifi.on('connected', (data) => {
  sendNotification(`Device *${data.hostname}* has Connected to *${data.ssid}* on channel ${data.channel}.`)
})

unifi.on('disconnected', (data) => {
  sendNotification(`Device *${data.hostname}* has Disconnected from *${data.ssid}*`)
})
