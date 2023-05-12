const Datastore = require('@seald-io/nedb')
const { CronJob } = require('cron')
const config = require('./config')
const usersDb = require('./users/db')
const auth = require('./auth')
const path = require('path')
const fs = require('fs')

const { refresh } = require('./tools')
const API = require('./api')

const dbs = {
  _: {},

  get(user) {
    if (!this._[user]) {
      this._[user] = {
        artistsDb: new Datastore({
          filename: `users/dbs/${user}/artists`,
          autoload: true,
        }),
        albumsDb: new Datastore({
          filename: `users/dbs/${user}/albums`,
          autoload: true,
        }),
        tracksDb: new Datastore({
          filename: `users/dbs/${user}/tracks`,
          autoload: true,
        }),
      }
    }

    return this._[user]
  },
}

const getIds = (i) => i._id

class SpotifyCrawler {
  constructor(username, days = 14) {
    this.username = username

    const { artistsDb, albumsDb, tracksDb } = dbs.get(this.username)

    this.artistsDb = artistsDb
    this.albumsDb = albumsDb
    this.tracksDb = tracksDb

    const date = new Date()
    date.setDate(date.getDate() - days)
    this.fromDate = date.getTime()
  }

  log(...args) {
    console.log(this.username, '##', ...args)
  }

  error(...args) {
    console.error(this.username, '##', ...args)
  }

  async isStarted() {
    const user = await usersDb.findOneAsync({ _id: this.username })
    return user.started
  }

  async toggleStarted() {
    const started = await this.isStarted()

    return usersDb.updateAsync(
      { _id: this.username },
      { $set: { started: !started } }
    )
  }

  async init() {
    const token = await refresh(this.username)
    const user = await usersDb.findOneAsync({ _id: this.username })
    this.appears_on = user.appears_on
    this.request = new API(token)
  }

  async reset() {
    Promise.all(
      [this.artistsDb, this.albumsDb, this.tracksDb].map((e) =>
        e.removeAsync({}, { multi: true })
      )
    ).then(() => {})
  }

  async getArtistIds(last) {
    this.log(`Getting artists`)
    if (!last) {
      await this.artistsDb.removeAsync({}, { multi: true })
    }
    const artists = await this.artistsDb.findAsync()
    const artistIds = artists.map(getIds)

    const { body } = await this.request.get(
      `me/following?type=artist&limit=50${last ? `&after=${last}` : ''}`
    )
    if (!body?.artists.items.length) {
      return artistIds
    }

    const newArtists = body.artists.items
      .map((i) => ({
        _id: i.id,
        name: i.name,
      }))
      .filter(
        // remove duplicates
        (artist, i, self) =>
          i === self.findIndex((t) => t._id === artist._id) &&
          !artistIds.includes(artist._id)
      )

    await this.artistsDb.insertAsync(newArtists)

    const lastArtistId = body.artists.cursors.after
    if (!lastArtistId) {
      const artists = await this.artistsDb.findAsync()
      this.log(
        'Total received',
        body.artists.total,
        `(stored: ${artists.length})`
      )
      return artists.map(getIds)
    }

    return this.getArtistIds(lastArtistId)
  }

  async getAlbumIds(artistId) {
    this.log(`Getting albums for ${artistId}`)
    const albums = await this.albumsDb.findAsync()
    const albumIds = albums.map(getIds)
    const isReallyNew = (e) =>
      new Date(e.release_date).getTime() >= this.fromDate

    const { body } = await this.request.get(
      `artists/${artistId}/albums?album_type=single,album${
        this.appears_on !== false ? ',appears_on' : ''
      }&market=FR&limit=10&offset=0`
    )
    if (!body?.items.length) {
      return []
    }

    const ids = body.items
      .filter(isReallyNew)
      .filter((e) => !albumIds.includes(e.id))
      .map((i) => ({ _id: i.id }))
    const newDocs = await this.albumsDb.insertAsync(ids)

    return newDocs.map((d) => d._id)
  }

  async getTrackURIs(albums = []) {
    if (!albums.length) {
      return []
    }
    this.log(`Getting tracks for ${albums}`)

    const tracks = await this.tracksDb.findAsync()
    const trackIds = tracks.map(getIds)

    const { body } = await this.request.get(`albums?ids=${albums.join(',')}`)
    if (!body) {
      return []
    }
    try {
      const tracks = [].concat(
        ...body.albums.map((a) => a.tracks.items.map((i) => i.uri))
      )
      const newDocs = await this.tracksDb.insertAsync(
        tracks
          .filter((e) => !trackIds.includes(e))
          .map((_id) => ({
            _id,
          }))
      )
      return newDocs.map((d) => d._id)
    } catch (e) {
      this.log(e)
      this.log(body.albums.map((a) => a.tracks.items))
      return this.getTrackURIs(albums)
    }
  }

  async getPlaylistId() {
    this.log('Getting playlist id')
    const {
      body: { items: playlists },
    } = await this.request.get(`users/${this.username}/playlists`)

    const playlist = playlists.find((p) => p.name === config.playlistName)
    if (playlist) {
      await this.request.put(
        `users/${this.username}/playlists/${playlist.id}`,
        {
          json: {
            description: config.playlistDescription,
          },
        }
      )
      return playlist.id
    }

    const {
      body: { id: playlistId },
    } = await this.request.post(`users/${this.username}/playlists`, {
      json: {
        name: config.playlistName,
        description: config.playlistDescription,
      },
    })

    // Set image
    try {
      const filepath = path.join(__dirname, '.github', 'large.jpg')
      const buffer = fs.readFileSync(filepath)
      await this.request.put(
        `users/${this.username}/playlists/${playlistId}/images`,
        {
          body: buffer.toString('base64'),
        }
      )
    } catch (e) {
      console.error(e)
    }
    return playlistId
  }

  async addTracks(playlistId, trackIds = []) {
    this.log('New tracks:', trackIds.length)

    const chunkSize = 100
    const chunks = []
    for (let i = 0, j = trackIds.length; i < j; i += chunkSize) {
      chunks.push(trackIds.slice(i, i + chunkSize))
    }

    const url = `users/${this.username}/playlists/${playlistId}/tracks`

    await this.request.put(url, {
      json: {
        uris: chunks.shift() || [],
      },
    })
    for await (const uris of chunks) {
      await this.request.post(url, {
        json: {
          uris,
        },
      })
    }
  }

  async setError(playlistId, message) {
    const url = `users/${this.username}/playlists/${playlistId}`

    await this.request.put(url, {
      json: {
        description: message,
      },
    })
  }
}

const crawl = async (user, nbDays) => {
  const crawler = new SpotifyCrawler(user, nbDays)
  try {
    const started = await crawler.isStarted()
    if (started) {
      crawler.log('Already started')
      return false
    }
  } catch (err) {
    crawler.log(`User ${user} not found`)
    return false
  }
  await crawler.toggleStarted()

  try {
    console.time('Process')
    await crawler.init()

    const artists = await crawler.getArtistIds()

    const tracks = new Set()
    for await (const artist of artists) {
      const albumIds = await crawler.getAlbumIds(artist)
      const trackIds = await crawler.getTrackURIs(albumIds)
      trackIds.forEach(tracks.add, tracks)
    }

    const playlist = await crawler.getPlaylistId()
    await crawler.addTracks(playlist, [...tracks])
  } catch (err) {
    crawler.error(err)

    let message = 'An unexpected error occurred during data retrieval.'
    if (err.error === 'invalid_grant') {
      message += ` ${err.error_description}.`
    } else if (config.discussion) {
      message += ' Ask for support at spotify.yoannboyer.com/ask'
    }

    try {
      const playlist = await crawler.getPlaylistId()
      await crawler.addTracks(playlist, [])
      await crawler.setError(playlist, message)
    } catch (err) {
      crawler.error(err)
    }
  } finally {
    console.timeEnd('Process')
    await crawler.toggleStarted()
  }

  return true
}

const start = async () => {
  const users = await usersDb.findAsync()
  const userIds = users.filter((i) => i.subscribed).map((i) => i._id)

  console.log('Users:', userIds.join(', '))

  for await (const userId of userIds) {
    await crawl(userId)
  }
}

if (process.env.NODE_ENV === 'production') {
  // eslint-disable-next-line no-new
  new CronJob('0 0 * * 5', start, null, true)
}

auth.emitter.on('crawl', crawl)
auth.emitter.on('delete', (id) => {
  const crawler = new SpotifyCrawler(id)
  return crawler.reset()
})
auth.emitter.on('reset', async (id, nbDays) => {
  const crawler = new SpotifyCrawler(id, nbDays || 7)
  await crawler.reset()
  return crawl(id, nbDays)
})

auth.listen(3000, () => console.log('Listening...'))
