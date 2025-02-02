const Datastore = require('@seald-io/nedb')
const { CronJob } = require('cron')
const config = require('./config')
const usersDb = require('./users/db')
const auth = require('./auth')
const path = require('path')
const fs = require('fs/promises')

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

  async setStarted(started) {
    return usersDb.updateAsync({ _id: this.username }, { $set: { started } })
  }

  async init() {
    const token = await refresh(this.username)
    const user = await usersDb.findOneAsync({ _id: this.username })
    this.appears_on = user.appears_on
    this.request = new API(token)
  }

  async reset() {
    await Promise.all(
      [this.artistsDb, this.albumsDb, this.tracksDb].map((e) =>
        e.removeAsync({}, { multi: true }),
      ),
    )
  }

  async drop() {
    await Promise.all(
      [this.artistsDb, this.albumsDb, this.tracksDb].map((e) =>
        e.dropDatabaseAsync(),
      ),
    )
    await usersDb.remove({ _id: this.username })
  }

  async getArtistIds(last) {
    this.log(`Getting artists`)
    if (!last) {
      await this.artistsDb.removeAsync({}, { multi: true })
    }
    const artistIds = (await this.artistsDb.findAsync()).map(getIds)

    const { data } = await this.request.get(
      `me/following?type=artist&limit=50${last ? `&after=${last}` : ''}`,
    )
    if (!data?.artists.items.length) {
      return artistIds
    }

    const newArtists = data.artists.items
      .map((i) => ({
        _id: i.id,
        name: i.name,
      }))
      .filter(
        // remove duplicates
        (artist, i, self) =>
          i === self.findIndex((t) => t._id === artist._id) &&
          !artistIds.includes(artist._id),
      )

    await this.artistsDb.insertAsync(newArtists)

    const lastArtistId = data.artists.cursors.after
    if (!lastArtistId) {
      const artistIds = (await this.artistsDb.findAsync()).map(getIds)
      this.log(
        'Total received',
        data.artists.total,
        `(stored: ${artistIds.length})`,
      )
      return artistIds
    }

    return this.getArtistIds(lastArtistId)
  }

  async getAlbumIds(artistId) {
    this.log(`Getting albums for ${artistId}`)
    const albumIds = (await this.albumsDb.findAsync()).map(getIds)
    const isReallyNew = (e) =>
      new Date(e.release_date).getTime() >= this.fromDate

    const { data } = await this.request.get(
      `artists/${artistId}/albums?include_groups=single,album${
        this.appears_on !== false ? ',appears_on' : ''
      }&market=FR&limit=10&offset=0`,
    )
    if (!data?.items.length) {
      return []
    }

    const ids = data.items
      .filter(isReallyNew)
      .map((i) => i.id)
      .filter((id) => !albumIds.includes(id))

    for (const _id of ids) {
      try {
        await this.albumsDb.insertAsync({ _id })
      } catch (e) {
        this.log(e)
      }
    }

    return ids
  }

  async getTrackURIs(albums = []) {
    if (!albums.length) {
      return []
    }
    this.log(`Getting tracks for ${albums}`)

    const trackIds = (await this.tracksDb.findAsync()).map(getIds)

    const { data } = await this.request.get(`albums?ids=${albums.join(',')}`)
    if (!data) {
      return []
    }
    const tracks = data.albums
      .map((a) => a.tracks.items.map((i) => i.uri))
      .flat()
    const ids = tracks.filter((e) => !trackIds.includes(e))
    for (const _id of ids) {
      try {
        await this.tracksDb.insertAsync({ _id })
      } catch (e) {
        this.log(e)
      }
    }
    return ids
  }

  async getPlaylistId() {
    this.log('Getting playlist id')
    const {
      data: { items: playlists },
    } = await this.request.get(`users/${this.username}/playlists`)

    const playlist = playlists.find((p) => p.name === config.playlistName)
    if (playlist) {
      await this.request.put(
        `users/${this.username}/playlists/${playlist.id}`,
        {
          description: config.playlistDescription,
        },
      )
      return playlist.id
    }

    const {
      data: { id: playlistId },
    } = await this.request.post(`users/${this.username}/playlists`, {
      name: config.playlistName,
      description: config.playlistDescription,
    })

    // Set image
    try {
      const filepath = path.join(__dirname, '.github', 'large.jpg')
      const img = await fs.readFile(filepath, { encoding: 'base64' })
      await this.request.put(
        `users/${this.username}/playlists/${playlistId}/images`,
        img,
        {
          headers: {
            'Content-Type': 'image/jpeg',
          },
        },
      )
    } catch (e) {
      console.error(e)
    }
    return playlistId
  }

  async getPlaylistTrackURIs(playlistId, offset = 0) {
    this.log(`Getting playlist tracks (offset: ${offset})`)
    const limit = 50
    const url = `users/${this.username}/playlists/${playlistId}/tracks`

    const { data } = await this.request.get(
      `${url}?limit=${limit}&offset=${offset}`,
    )

    const trackURIs = data.items
      .map((i) => i.track)
      .filter(Boolean)
      .map((t) => t.uri)

    if (!data.next) {
      return trackURIs
    }

    const uris = await this.getPlaylistTrackURIs(playlistId, offset + limit)

    return [...new Set([...trackURIs, ...uris])]
  }

  async removeTracks(playlistId) {
    const trackIds = await this.getPlaylistTrackURIs(playlistId)

    this.log(`Removing tracks: ${trackIds.length}`)

    const chunkSize = 100
    const chunks = []
    for (let i = 0, j = trackIds.length; i < j; i += chunkSize) {
      chunks.push(trackIds.slice(i, i + chunkSize))
    }

    if (!chunks.length) {
      return
    }

    const url = `users/${this.username}/playlists/${playlistId}/tracks`

    for (const uris of chunks) {
      await this.request.delete(url, {
        data: {
          tracks: uris.map((uri) => ({ uri })),
        },
      })
    }
  }

  async addTracks(playlistId, trackIds = []) {
    this.log('New tracks:', trackIds.length)

    const chunkSize = 100
    const chunks = []
    for (let i = 0, j = trackIds.length; i < j; i += chunkSize) {
      chunks.push(trackIds.slice(i, i + chunkSize))
    }

    if (!chunks.length) {
      return
    }

    const url = `users/${this.username}/playlists/${playlistId}/tracks`

    for (const uris of chunks) {
      await this.request.post(url, {
        uris,
      })
    }
  }

  async setError(playlistId, message) {
    const url = `users/${this.username}/playlists/${playlistId}`

    await this.request.put(url, {
      description: message,
    })
  }
}

const crawl = async (user, nbDays) => {
  const crawler = new SpotifyCrawler(user, nbDays)
  try {
    const started = await crawler.isStarted()
    if (started) {
      crawler.log('Already started')
      await crawler.setStarted(false)
      return false
    }
  } catch (err) {
    crawler.log(`User ${user} not found`)
    return false
  }
  await crawler.setStarted(true)

  const process = performance.now()
  try {
    await crawler.init()

    const artists = await crawler.getArtistIds()

    const tracks = new Set()
    let i = 1
    for (const artist of artists) {
      crawler.log(`Artist ${i++}/${artists.length}`)
      const albumIds = await crawler.getAlbumIds(artist)
      const trackIds = await crawler.getTrackURIs(albumIds)
      trackIds.forEach(tracks.add, tracks)
    }

    const playlist = await crawler.getPlaylistId()
    await crawler.removeTracks(playlist)
    await crawler.addTracks(playlist, [...tracks])
  } catch (err) {
    crawler.error(err)
    if (err.message === 'Refresh token revoked') {
      await crawler.drop()
      crawler.log(`Process: ${performance.now() - process}ms`)
      return false
    }

    let message = 'An unexpected error occurred during data retrieval.'
    if (err.error === 'invalid_grant') {
      message += ` ${err.error_description}.`
    } else if (config.discussion) {
      message += ' Ask for support at spotify.yoannboyer.com/ask'
    }

    try {
      const playlist = await crawler.getPlaylistId()
      await crawler.removeTracks(playlist)
      await crawler.setError(playlist, message)
    } catch (err) {
      crawler.error('Impossible to set error message')
      crawler.error(err)
    }
  } finally {
    crawler.log(`Process: ${performance.now() - process}ms`)
    await crawler.setStarted(false)
  }

  return true
}

const start = async () => {
  const userIds = (await usersDb.findAsync())
    .filter((i) => i.subscribed)
    .map((i) => i._id)

  console.log('Users:', userIds.join(', '))

  for (const userId of userIds) {
    await crawl(userId)
  }
}

if (process.env.NODE_ENV === 'production') {
  new CronJob('0 0 * * 5', start, null, true)
}

auth.emitter.on('crawl', crawl)
auth.emitter.on('delete', (id) => {
  const crawler = new SpotifyCrawler(id)
  return crawler.reset()
})
auth.emitter.on('reset', async (id, nbDays) => {
  const crawler = new SpotifyCrawler(id)
  await crawler.reset()
  return crawl(id, nbDays)
})

auth.listen(3000, () =>
  console.log(`Listening with admin key "${config.adminKey}"...`),
)
