module.exports = {
  client_id: process.env.CLIENT_ID,
  client_secret: process.env.CLIENT_SECRET,
  redirect_uri: process.env.REDIRECT_URI,
  get playlist_name() {
    let name = 'Real Release Radar'
    if (process.env.NODE_ENV !== 'production') {
      name = `[DEV] ${name}`
    }
    return name
  },
  playlist_description:
    'Week releases every friday. // https://spotify.yoannboyer.com/',
}
