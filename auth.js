const crypto = require('crypto')
const express = require('express')
const morgan = require('morgan')
const got = require('got')
const cookieParser = require('cookie-parser')
const shortid = require('shortid')
const EventEmitter = require('events')

const usersDb = require('./users/db')
const config = require('./config')

const stateKey = 'spotify_auth_state'
const actionKey = 'rrr_action'
const salt = shortid()

const encrypt = ({ key, value }) =>
  crypto
    .createHmac('sha512', key + salt)
    .update(`${value}`)
    .digest('hex')
    .slice(0, 7)

const codes = {
  [encrypt({
    value: 1,
  })]: `Done. Now just wait a few minutes for the playlist to fill. (~5min). Each friday the content of the playlist "${config.playlistName}" will be updated with the new releases.`,
  [encrypt({
    value: 2,
  })]: `Done. Each friday the content of the playlist "${config.playlistName}" will be updated with the new releases.`,
  [encrypt({ value: 3 })]: 'Error. Please retry.',
  [encrypt({ value: 4 })]: 'User not logged. Please signin.',
  [encrypt({ value: 5 })]: 'User deleted.',
  [encrypt({
    value: 6,
  })]: `Include artists appearing on other albums: enabled. Retrieving tracks. Please wait.`,
  [encrypt({
    value: 7,
  })]: `Include artists appearing on other albums: disabled. Retrieving tracks. Please wait.`,
}

const findUser = (id) =>
  new Promise((resolve, reject) => {
    usersDb.findOne({ _id: id }, (err, doc) => {
      if (err || !doc) {
        return reject(err)
      }
      return resolve(doc)
    })
  })

const querySpotifyUser = async (accessToken) => {
  const options = {
    url: 'https://api.spotify.com/v1/me',
    headers: { Authorization: `Bearer ${accessToken}` },
    responseType: 'json',
  }

  const { body } = await got.get(options)
  return body
}

const getTokens = async (code) => {
  const authOptions = {
    url: 'https://accounts.spotify.com/api/token',
    form: {
      code,
      redirect_uri: config.redirectUri,
      grant_type: 'authorization_code',
    },
    headers: {
      Authorization: `Basic ${Buffer.from(
        `${config.clientId}:${config.clientSecret}`
      ).toString('base64')}`,
    },
    responseType: 'json',
  }

  const {
    // eslint-disable-next-line camelcase
    body: { access_token, refresh_token },
  } = await got.post(authOptions)

  return {
    access_token,
    refresh_token,
  }
}

const app = express()
app.use(cookieParser())
app.use(
  morgan(
    ':date[iso] :remote-addr :method :url HTTP/:http-version :status - :response-time ms'
  )
)
app.emitter = new EventEmitter()

const actions = {
  // eslint-disable-next-line camelcase
  async subscribe({ user, access_token, refresh_token, res }) {
    const dbUser = await findUser(user.id).catch(() => {})

    usersDb.update(
      { _id: user.id },
      { _id: user.id, access_token, refresh_token },
      { upsert: true },
      () => {
        if (dbUser) {
          return res.redirect(`/done/${encrypt({ value: 2 })}`)
        }

        app.emitter.emit('crawl', user.id)
        return res.redirect(`/done/${encrypt({ value: 1 })}`)
      }
    )
  },

  async unsubscribe({ user, res }) {
    usersDb.remove({ _id: user.id }, {}, (err, numRemoved) => {
      if (!err && numRemoved === 1) {
        app.emitter.emit('delete', user.id)
      }

      res.redirect(`/done/${encrypt({ value: 5 })}`)
    })
  },

  // eslint-disable-next-line consistent-return
  async toggle_appears_on({ user, res }) {
    const dbUser = await findUser(user.id).catch(() => {})

    if (!dbUser) {
      return res.redirect(`/done/${encrypt({ value: 4 })}`)
    }

    const enabled = !dbUser.appears_on

    usersDb.update({ _id: user.id }, { $set: { appears_on: enabled } }, () => {
      app.emitter.emit('reset', user.id, 7)
      if (enabled) {
        return res.redirect(`/done/${encrypt({ value: 6 })}`)
      }
      return res.redirect(`/done/${encrypt({ value: 7 })}`)
    })
  },
}

app.get('/', (req, res) => {
  res.end(`<html><body><pre>
Usage:
- <a href="/subscribe">/subscribe</a>: Subscribes to the Real Release Radar playlist
- <a href="/unsubscribe">/unsubscribe</a>: Unsubscribes from the service
- <a href="/toggle_appears_on">/toggle_appears_on</a>: Toggles the option to include the appearance of artists on other albums _(enabled by default)_

<a href="https://github.com/yboyer/realreleaseradar">https://github.com/yboyer/realreleaseradar</a>
</pre></body></html>`)
})

app.get(
  Object.keys(actions).map((k) => `/${k}`),
  (req, res) => {
    const state = shortid()
    const action = req.path.replace('/', '')

    res.cookie(stateKey, state)
    res.cookie(
      actionKey,
      encrypt({
        key: state,
        value: action,
      })
    )

    const scope = [
      'user-follow-read',
      'playlist-modify-public',
      'ugc-image-upload',
    ].join(' ')
    const params = new URLSearchParams([
      ['response_type', 'code'],
      ['client_id', config.clientId],
      ['scope', scope],
      ['redirect_uri', config.redirectUri],
      ['state', state],
    ])
    res.redirect(`https://accounts.spotify.com/authorize?${params.toString()}`)
  }
)

const getAction = (state, hash) =>
  Object.keys(actions).filter(
    (action) => encrypt({ key: state, value: action }) === hash
  )[0]

app.get('/callback', async (req, res) => {
  const code = req.query.code || null
  const state = req.query.state || null
  const storedState = req.cookies ? req.cookies[stateKey] : null
  const storedAction = req.cookies ? req.cookies[actionKey] : null

  const action = getAction(state, storedAction)

  console.log('Action:', action)

  if (code === null || state === null || state !== storedState || !action) {
    return res.redirect(`/done/${encrypt({ value: 3 })}`)
  }

  res.clearCookie(stateKey)
  res.clearCookie(actionKey)

  // eslint-disable-next-line camelcase
  const { refresh_token, access_token } = await getTokens(code)

  const user = await querySpotifyUser(access_token)
  console.log('Logged user', user.id)

  return actions[action]({
    user,
    access_token,
    refresh_token,
    res,
  })
})

app.get('/done/:code', (req, res) => {
  res.end(codes[req.params.code])
})

app.get('/crawl/:userId', (req, res) => {
  app.emitter.emit('crawl', req.params.userId, req.query.nbDays)
  return res.redirect(`/done/${encrypt({ value: 1 })}`)
})

app.get('/reset/:userId', (req, res) => {
  app.emitter.emit('reset', req.params.userId, req.query.nbDays)
  return res.redirect(`/done/${encrypt({ value: 1 })}`)
})

app.get('/ask', (req, res) => {
  if (!config.discussion) {
    res.sendStatus(404)
  }
  res.redirect(config.discussion)
})

module.exports = app
