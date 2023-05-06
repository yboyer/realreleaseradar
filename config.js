require('dotenv').config()
require('dotenv').config()

module.exports = {
  isProduction: process.env.NODE_ENV === 'production',
  clientId: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  redirectUri: process.env.REDIRECT_URI,
  discussion: process.env.DISCUSSION,
  get playlistName() {
    let name = 'Real Release Radar'
    if (process.env.NODE_ENV !== 'production') {
      name = `[DEV] ${name}`
    }
    return name
  },
  playlistDescription:
    'ALL new releases of your followed artists every Friday. Create your own: https://spotify.yoannboyer.com',
}
