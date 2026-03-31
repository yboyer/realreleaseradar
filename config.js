const crypto = require('node:crypto')
const { cleanEnv, str, url } = require('envalid')

module.exports = cleanEnv(process.env, {
  NODE_ENV: str({ default: 'development' }),
  CLIENT_ID: str(),
  CLIENT_SECRET: str(),
  REDIRECT_URI: url({
    devDefault: 'http://localhost:3000/callback',
  }),
  DISCUSSION: str({ default: '' }),
  ADMIN_KEY: str({ default: crypto.randomBytes(4).toString('hex') }),
  PLAYLIST_NAME: str({ default: 'Real Release Radar', devDefault: '[DEV] Real Release Radar' }),
  PLAYLIST_DESCRIPTION: str({
    default:
      'ALL new releases of your followed artists every Friday. Create your own: https://spotify.yoannboyer.com',
  }),
})
