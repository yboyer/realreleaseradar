const crypto = require('crypto')
const express = require('express')
const morgan = require('morgan')
const got = require('got')
const cookieParser = require('cookie-parser')
const { nanoid } = require('nanoid')
const EventEmitter = require('events')

const usersDb = require('./users/db')
const config = require('./config')

const stateKey = 'spotify_auth_state'
const actionKey = 'rrr_action'
const salt = nanoid()

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

async function setCookieAndSend(res, id) {
  const dbUser = await findUser(id).catch(() => {})
  res.cookie(
    'user',
    dbUser
      ? Buffer.from(
          JSON.stringify({
            name: dbUser.name,
            image: dbUser.image,
            subscribed: dbUser.subscribed,
            includeFeaturing: dbUser.appears_on,
          })
        ).toString('base64')
      : ''
  )
  res.redirect('/')
}

const actions = {
  async connect({ user, access_token, refresh_token, res }) {
    usersDb.update(
      { _id: user.id },
      {
        $set: {
          _id: user.id,
          access_token,
          refresh_token,
          image: user.images[0]?.url,
          name: user.display_name,
        },
      },
      { upsert: true },
      () => {
        setCookieAndSend(res, user.id)
      }
    )
  },

  // eslint-disable-next-line camelcase
  async subscribe({ user, access_token, refresh_token, res }) {
    const dbUser = await findUser(user.id).catch(() => {})

    usersDb.update(
      { _id: user.id },
      { $set: { _id: user.id, access_token, refresh_token, subscribed: true } },
      { upsert: true },
      () => {
        if (!dbUser.subscribed) {
          app.emitter.emit('crawl', user.id)
        }

        setCookieAndSend(res, user.id)
      }
    )
  },

  async unsubscribe({ user, res }) {
    usersDb.remove({ _id: user.id }, {}, (err, numRemoved) => {
      if (!err && numRemoved === 1) {
        app.emitter.emit('delete', user.id)
      }

      setCookieAndSend(res, user.id)
    })
  },

  // eslint-disable-next-line consistent-return
  async toggleFeaturing({ user, res }) {
    const dbUser = await findUser(user.id).catch(() => {})

    if (!dbUser) {
      return setCookieAndSend(res, user.id)
    }

    const enabled = !dbUser.appears_on

    usersDb.update({ _id: user.id }, { $set: { appears_on: enabled } }, () => {
      app.emitter.emit('reset', user.id, 7)

      setCookieAndSend(res, user.id)
    })
  },
}

app.get(
  Object.keys(actions).map((k) => `/${k}`),
  (req, res) => {
    const state = nanoid()
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

app.use(express.static('static'))

app.get('*', (_req, res) => {
  res.redirect('/')
})

module.exports = app
