const crypto = require('crypto')
const express = require('express')
const morgan = require('morgan')
const axios = require('axios')
const cookieParser = require('cookie-parser')
const EventEmitter = require('events')

const usersDb = require('./users/db')
const config = require('./config')
const API = require('./api')

const stateKey = 'spotify_auth_state'
const actionKey = 'rrr_action'

const randomString = () => crypto.randomBytes(4).toString('hex')

const salt = randomString()
const encrypt = ({ key, value }) =>
  crypto
    .createHmac('sha512', key + salt)
    .update(`${value}`)
    .digest('hex')
    .slice(0, 7)

const codes = {
  [encrypt({ value: 1 })]:
    `Done. Now just wait a few minutes for the playlist to fill. (~5min). Each friday the content of the playlist "${config.playlistName}" will be updated with the new releases.`,
  [encrypt({ value: 2 })]:
    `Done. Each friday the content of the playlist "${config.playlistName}" will be updated with the new releases.`,
  [encrypt({ value: 3 })]: 'Error. Please retry.',
  [encrypt({ value: 4 })]: 'User not logged. Please signin.',
  [encrypt({ value: 5 })]: 'User deleted.',
  [encrypt({ value: 6 })]:
    `Include artists appearing on other albums: enabled. Retrieving tracks. Please wait.`,
  [encrypt({ value: 7 })]:
    `Include artists appearing on other albums: disabled. Retrieving tracks. Please wait.`,
}

const getTokens = async (code) => {
  const {
    data: { access_token, refresh_token },
  } = await axios.post(
    'https://accounts.spotify.com/api/token',
    {
      code,
      redirect_uri: config.redirectUri,
      grant_type: 'authorization_code',
    },
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(
          `${config.clientId}:${config.clientSecret}`,
        ).toString('base64')}`,
      },
    },
  )

  return {
    access_token,
    refresh_token,
  }
}

const app = express()
app.use(cookieParser())
app.use(
  morgan(
    ':date[iso] :remote-addr :method :url HTTP/:http-version :status - :response-time ms',
  ),
)
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store')
  next()
})
app.emitter = new EventEmitter()

async function setCookieAndSend(res, userId) {
  const dbUser = await usersDb.findOneAsync({ _id: userId }).catch(() => {})
  res.cookie(
    'user',
    dbUser
      ? Buffer.from(
          JSON.stringify({
            name: dbUser.name,
            image: dbUser.image,
            subscribed: dbUser.subscribed,
            artists: dbUser.artists,
            includeFeaturing: dbUser.appears_on,
          }),
        ).toString('base64')
      : '',
    {
      sameSite: true,
      maxAge: 10_000,
      secure: config.isProduction,
    },
  )
  res.redirect('/')
}

const actions = {
  async connect({ user, access_token, refresh_token, res }) {
    const api = new API(access_token)
    const { data } = await api.get('me/following?type=artist&limit=1')

    await usersDb.updateAsync(
      { _id: user.id },
      {
        $set: {
          artists: data.artists.total,
          _id: user.id,
          access_token,
          refresh_token,
          image: user.images[0]?.url,
          name: user.display_name,
        },
      },
      { upsert: true },
    )
    setCookieAndSend(res, user.id)
  },

  async subscribe({ user, access_token, refresh_token, res }) {
    const dbUser = await usersDb.findOneAsync({ _id: user.id }).catch(() => {})

    await usersDb.updateAsync(
      { _id: user.id },
      { $set: { _id: user.id, access_token, refresh_token, subscribed: true } },
      { upsert: true },
    )
    if (!dbUser?.subscribed) {
      app.emitter.emit('crawl', user.id)
    }

    setCookieAndSend(res, user.id)
  },

  async unsubscribe({ user, res }) {
    const result = await usersDb
      .removeAsync({ _id: user.id }, {})
      .catch(() => {})
    if (result?.numRemoved === 1) {
      app.emitter.emit('delete', user.id)
    }

    setCookieAndSend(res, user.id)
  },

  async toggleFeaturing({ user, res }) {
    const dbUser = await usersDb.findOneAsync({ _id: user.id }).catch(() => {})

    if (!dbUser) {
      return setCookieAndSend(res, user.id)
    }

    const enabled = !dbUser.appears_on

    await usersDb.updateAsync(
      { _id: user.id },
      { $set: { appears_on: enabled } },
    )
    app.emitter.emit('reset', user.id, 7)

    setCookieAndSend(res, user.id)
  },
}

app.get(
  Object.keys(actions).map((k) => `/${k}`),
  (req, res) => {
    const state = randomString()
    const action = req.path.replace('/', '')

    res.cookie(stateKey, state)
    res.cookie(
      actionKey,
      encrypt({
        key: state,
        value: action,
      }),
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
  },
)

const getAction = (state, hash) =>
  Object.keys(actions).filter(
    (action) => encrypt({ key: state, value: action }) === hash,
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

  const { refresh_token, access_token } = await getTokens(code)

  const api = new API(access_token)
  const { data: user } = await api.get('me')
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

const adminRouter = express.Router()
adminRouter.get('/crawl/:userId', (req, res) => {
  app.emitter.emit('crawl', req.params.userId, req.query.nbDays)
  return res.redirect(`/done/${encrypt({ value: 1 })}`)
})
adminRouter.get('/reset/:userId', (req, res) => {
  app.emitter.emit('reset', req.params.userId, req.query.nbDays)
  return res.redirect(`/done/${encrypt({ value: 1 })}`)
})
app.use(`/admin/${config.adminKey}`, adminRouter)

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
