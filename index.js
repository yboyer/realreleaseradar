const axios = require('axios');
const Datastore = require('nedb');
const { CronJob } = require('cron');
const usersDb = require('./users/db');
const auth = require('./auth');
const config = require('./config');

const { refresh } = require('./tools');

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
      };
    }

    return this._[user];
  },
};

const DB = {
  async find(db, query = {}) {
    return new Promise((resolve, reject) => {
      db.find(query, (err, docs) => {
        if (err) {
          return reject(err);
        }
        return resolve(docs.map(i => i._id));
      });
    });
  },
  async findOne(db, query = {}) {
    return new Promise((resolve, reject) => {
      db.findOne(query, (err, doc) => {
        if (err) {
          return reject(err);
        }
        return resolve(doc);
      });
    });
  },
  async remove(db, query = {}, options = {}) {
    return new Promise((resolve, reject) => {
      db.remove(query, options, (err, doc) => {
        if (err) {
          return reject(err);
        }
        return resolve(doc);
      });
    });
  },
  async update(db, query = {}, update = {}) {
    return new Promise((resolve, reject) => {
      db.update(query, update, (err, doc) => {
        if (err) {
          return reject(err);
        }
        return resolve(doc);
      });
    });
  },
  async insert(db, query = {}) {
    return new Promise((resolve, reject) => {
      db.insert(query, (err, doc) => {
        if (err) {
          return reject(err);
        }
        return resolve(doc);
      });
    });
  },
};

class SpotifyCrawler {
  constructor(username) {
    this.request = axios.create({
      baseURL: 'https://api.spotify.com/v1',
    });
    ['get', 'put', 'post'].forEach(k => {
      const method = this.request[k];
      this.request[k] = (...args) =>
        method(...args).catch(err => {
          this.log(err.response.status, err.response.data);

          switch (err.response.status) {
            case 400:
            case 429:
            case 500:
            case 501:
            case 502:
              return new Promise((resolve, reject) => {
                const ms =
                  Number(err.response.headers['retry-after']) * 1e3 + 1e3 ||
                  3e3;
                this.log(`Waiting ${ms / 1000} second`);
                setTimeout(
                  () => this.request[k](...args).then(resolve, reject),
                  ms,
                );
              });
            default:
              throw err;
          }
        });
    });

    this.username = username;

    const { artistsDb, albumsDb, tracksDb } = dbs.get(this.username);

    this.artistsDb = artistsDb;
    this.albumsDb = albumsDb;
    this.tracksDb = tracksDb;

    const date = new Date();
    date.setDate(date.getDate() - 15);
    this.fifteenDays = date.getTime();
  }

  log(...args) {
    console.log(this.username, '##', ...args);
  }

  async isStarted() {
    return DB.findOne(usersDb, { _id: this.username }).then(doc => doc.started);
  }

  async toggleStarted() {
    const started = await this.isStarted();

    return DB.update(
      usersDb,
      { _id: this.username },
      { $set: { started: !started } },
    );
  }

  async init() {
    const token = await refresh(this.username);
    this.appears_on = await DB.findOne(usersDb, { _id: this.username }).then(
      doc => doc.appears_on,
    );
    this.request.defaults.headers.common.Authorization = `Bearer ${token}`;
  }

  async reset() {
    Promise.all(
      [this.artistsDb, this.albumsDb, this.tracksDb].map(e =>
        DB.remove(e, {}, { multi: true }),
      ),
    ).then(() => {});
  }

  async getArtistIds(last) {
    this.log(`Getting artists for ${this.username}`);
    if (!last) {
      await DB.remove(this.artistsDb, {}, { multi: true });
    }
    const artistsIds = await DB.find(this.artistsDb);

    const { data } = await this.request.get(
      `/me/following?type=artist&limit=50${last ? `&after=${last}` : ''}`,
    );
    if (!data.artists.items.length) {
      return artistsIds;
    }

    const artists = data.artists.items
      .map(i => ({
        _id: i.id,
        name: i.name,
      }))
      .filter(
        // remove duplicates
        (artist, i, self) =>
          i === self.findIndex(t => t._id === artist._id) &&
          !artistsIds.includes(artist._id),
      );

    await DB.insert(this.artistsDb, artists);

    const lastArtistId = data.artists.cursors.after;
    if (!lastArtistId) {
      const ids = await DB.find(this.artistsDb);
      this.log('Total received', data.artists.total, `(stored: ${ids.length})`);
      return ids;
    }

    return this.getArtistIds(lastArtistId);
  }

  async getAlbumIds(artistId) {
    this.log(`Getting albums for ${artistId}`);
    const albumsIds = await DB.find(this.albumsDb);
    const doNotIncludes = e => !albumsIds.includes(e.id);
    const isReallyNew = e =>
      new Date(e.release_date).getTime() > this.fifteenDays;

    const { data } = await this.request.get(
      `/artists/${artistId}/albums?album_type=single,album${
        this.appears_on !== false ? ',appears_on' : ''
      }&market=FR&limit=10&offset=0`,
    );
    if (!data.items.length) {
      return [];
    }

    const ids = data.items
      .filter(isReallyNew)
      .filter(doNotIncludes)
      .map(i => ({ _id: i.id }));
    const newDocs = await DB.insert(this.albumsDb, ids);

    return newDocs.map(d => d._id);
  }

  async getTrackURIs(albums = []) {
    if (!albums.length) {
      return [];
    }
    this.log(`Getting tracks for ${albums}`);

    const tracksIds = await DB.find(this.tracksDb);
    const doNotIncludes = e => !tracksIds.includes(e);

    const { data } = await this.request.get(`/albums?ids=${albums.join(',')}`);
    try {
      const tracks = [].concat(
        ...data.albums.map(a => a.tracks.items.map(i => i.uri)),
      );
      const newDocs = await DB.insert(
        this.tracksDb,
        tracks.filter(doNotIncludes).map(i => ({ _id: i })),
      );
      return newDocs.map(d => d._id);
    } catch (e) {
      this.log(e);
      this.log(data.albums.map(a => a.tracks.items));
      return this.getTrackURIs(albums);
    }
  }

  async getPlaylistId() {
    const resGet = await this.request.get(`/users/${this.username}/playlists`);

    const playlist = resGet.data.items.find(
      p => p.name === config.playlist_name,
    );
    if (playlist) {
      return playlist.id;
    }

    const resCreate = await this.request.post(
      `/users/${this.username}/playlists`,
      {
        name: config.playlist_name,
        description: config.playlist_description,
      },
    );
    return resCreate.data.id;
  }

  async addTracks(playlistId, trackIds = []) {
    this.log('New tracks:', trackIds.length);

    const chunkSize = 100;
    const chunks = [];
    for (let i = 0, j = trackIds.length; i < j; i += chunkSize) {
      chunks.push(trackIds.slice(i, i + chunkSize));
    }

    const url = `/users/${this.username}/playlists/${playlistId}/tracks`;

    await this.request.put(url, { uris: chunks.shift() || [] });
    return chunks
      .reduce(
        (chain, m) => chain.then(() => this.request.post(url, { uris: m })),
        Promise.resolve(),
      )
      .then(() => {});
  }
}

const crawl = async user => {
  const crawler = new SpotifyCrawler(user);
  const started = await crawler.isStarted();
  if (started) {
    crawler.log('Already started');
    return false;
  }
  await crawler.toggleStarted();

  try {
    await crawler.init();

    console.time('Process');
    const artists = await crawler.getArtistIds();

    const tracks = await artists.reduce(
      (chain, artist) =>
        chain.then(async (arr = []) => {
          const albumIds = await crawler.getAlbumIds(artist);
          const trackIds = await crawler.getTrackURIs(albumIds);
          return arr.concat(trackIds);
        }),
      Promise.resolve([]),
    );

    const playlist = await crawler.getPlaylistId();
    await crawler.addTracks(playlist, tracks);
  } catch (err) {
    console.error(err);
  } finally {
    console.timeEnd('Process');
    await crawler.toggleStarted();
  }

  return true;
};

const start = async () => {
  const users = await DB.find(usersDb);

  console.log('Users:', users.join(', '));

  return users.reduce(
    (chain, user) => chain.then(() => crawl(user)),
    Promise.resolve(),
  );
};

if (process.env.NODE_ENV === 'production') {
  // eslint-disable-next-line no-new
  new CronJob('0 0 * * 5', start, null, true);
}

auth.emitter.on('crawl', crawl);
auth.emitter.on('delete', id => {
  const crawler = new SpotifyCrawler(id);
  return crawler.reset();
});
auth.emitter.on('reset', async id => {
  const crawler = new SpotifyCrawler(id);
  await crawler.reset();
  return crawl(id);
});

auth.listen(3000, () => console.log('Listening...'));
