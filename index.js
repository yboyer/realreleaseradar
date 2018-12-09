const axios = require("axios");
const Datastore = require("nedb");
const cron = require("node-cron");
const usersDb = require("./users/db.js");
const auth = require("./auth");
const config = require("./config");

const { refresh } = require("./tools");

const dbs = {
  _: {},

  get(user) {
    if (!this._[user]) {
      this._[user] = {
        artistsDb: new Datastore({
          filename: `users/dbs/${user}/artists`,
          autoload: true
        }),
        albumsDb: new Datastore({
          filename: `users/dbs/${user}/albums`,
          autoload: true
        }),
        tracksDb: new Datastore({
          filename: `users/dbs/${user}/tracks`,
          autoload: true
        })
      };
    }

    return this._[user];
  }
};

const find = (db, query = {}) =>
  new Promise((resolve, reject) => {
    db.find(query, (err, docs) => {
      if (err) {
        return reject(err);
      }
      return resolve(docs.map(i => i._id));
    });
  });
const findOne = (db, query = {}) =>
  new Promise((resolve, reject) => {
    db.findOne(query, (err, doc) => {
      if (err) {
        return reject(err);
      }
      return resolve(doc);
    });
  });

class SpotifyCrawler {
  constructor(username) {
    this.request = axios.create({
      baseURL: "https://api.spotify.com/v1"
    });
    ["get", "put", "post"].forEach(k => {
      const method = this.request[k];
      this.request[k] = (...args) =>
        method(...args).catch(err => {
          this.log(err.response.status, err.response.data);

          switch (err.response.status) {
            case 429:
              return new Promise((resolve, reject) => {
                const seconds =
                  Number(err.response.headers["retry-after"]) * 1e3;
                this.log(`Waiting ${seconds} seconds`);
                setTimeout(
                  () => this.request[k](...args).then(resolve, reject),
                  seconds
                );
              });
            case 400:
            case 502:
              return new Promise((resolve, reject) => {
                setTimeout(
                  () => this.request[k](...args).then(resolve, reject),
                  1e3
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
    console.log(this.username, "##", ...args);
  }

  async isStarted() {
    return findOne(usersDb, {
      _id: this.username
    }).then(doc => doc.started);
  }

  async toggleStarted() {
    const started = await this.isStarted();

    return new Promise(resolve => {
      usersDb.update(
        { _id: this.username },
        { $set: { started: !started } },
        () => resolve()
      );
    });
  }

  async init() {
    const token = await refresh(this.username);
    this.appears_on = await findOne(usersDb, { _id: this.username }).then(
      doc => doc.appears_on
    );
    this.request.defaults.headers.common.Authorization = `Bearer ${token}`;
  }

  async reset() {
    Promise.all(
      [this.artistsDb, this.albumsDb, this.tracksDb].map(
        e =>
          new Promise(resolve => e.remove({}, { multi: true }, () => resolve()))
      )
    ).then(() => {});
  }

  async getArtists(last) {
    this.log(`Getting artists for ${this.username}`);
    const artistsIds = await find(this.artistsDb);
    const doNotIncludes = e => !artistsIds.includes(e.id);

    return this.request
      .get(`/me/following?type=artist&limit=50${last ? `&after=${last}` : ""}`)
      .then(({ data }) => {
        if (!data.artists.items.length) {
          return artistsIds;
        }

        return new Promise((resolve, reject) => {
          this.artistsDb.insert(
            data.artists.items.filter(doNotIncludes).map(i => ({ _id: i.id })),
            async (err, newDocs) => {
              if (err) {
                return reject(err);
              }

              const lastArtist = newDocs.pop();
              if (!lastArtist) {
                const artists = await find(this.artistsDb);
                return resolve(artists);
              }

              return this.getArtists(lastArtist._id).then(resolve, reject);
            }
          );
        });
      });
  }

  async getAlbums(artist) {
    this.log(`Getting albums for ${artist}`);
    const albumsIds = await find(this.albumsDb);
    const doNotIncludes = e => !albumsIds.includes(e.id);
    const isReallyNew = e =>
      new Date(e.release_date).getTime() > this.fifteenDays;

    return this.request
      .get(
        `/artists/${artist}/albums?album_type=single,album${
          this.appears_on !== false ? ",appears_on" : ""
        }&market=FR&limit=10&offset=0`
      )
      .then(({ data }) => {
        if (!data.items.length) {
          return [];
        }

        return new Promise((resolve, reject) => {
          this.albumsDb.insert(
            data.items
              .filter(isReallyNew)
              .filter(doNotIncludes)
              .map(i => ({ _id: i.id })),
            (err, newDocs) => {
              if (err) {
                return reject(err);
              }

              return resolve(newDocs.map(d => d._id));
            }
          );
        });
      });
  }

  async getTracks(albums) {
    if (!albums.length) {
      return [];
    }
    this.log(`Getting tracks for ${albums}`);

    const tracksIds = await find(this.tracksDb);
    const doNotIncludes = e => !tracksIds.includes(e);

    return this.request
      .get(`/albums?ids=${albums.join(",")}`)
      .then(({ data }) => {
        try {
          const tracks = [].concat(
            ...data.albums.map(a => a.tracks.items.map(i => i.uri))
          );
          return new Promise((resolve, reject) => {
            this.tracksDb.insert(
              tracks.filter(doNotIncludes).map(i => ({
                _id: i
              })),
              (err, newDocs) => {
                if (err) {
                  return reject(err);
                }

                return resolve(newDocs.map(d => d._id));
              }
            );
          });
        } catch (e) {
          this.log(e);
          this.log(data.albums.map(a => a.tracks.items));
          return this.getTracks(albums);
        }
      });
  }

  async getPlaylist() {
    return this.request
      .get(`/users/${this.username}/playlists`)
      .then(resGet => {
        const playlist = resGet.data.items.find(
          p => p.name === config.playlist_name
        );

        if (playlist) {
          return playlist.id;
        }

        return this.request
          .post(`/users/${this.username}/playlists`, {
            name: config.playlist_name,
            description: config.playlist_description
          })
          .then(resCreate => resCreate.data.id);
      });
  }

  async addTracks(playlist, tracks) {
    const chunkSize = 100;
    const chunks = [];
    for (let i = 0, j = tracks.length; i < j; i += chunkSize) {
      chunks.push(tracks.slice(i, i + chunkSize));
    }

    const url = `/users/${this.username}/playlists/${playlist}/tracks`;

    this.log("New tracks:", tracks.length);

    return this.request
      .put(url, { uris: chunks.shift() || [] })
      .then(() =>
        chunks
          .reduce(
            (chain, m) => chain.then(() => this.request.post(url, { uris: m })),
            Promise.resolve()
          )
          .then(() => {})
      );
  }
}

const crawl = async user => {
  const crawler = new SpotifyCrawler(user);
  const started = await crawler.isStarted();

  if (started) {
    return false;
  }
  await crawler.toggleStarted();
  await crawler.init();

  console.time("Process");
  return crawler
    .getArtists()
    .then(artists =>
      artists.reduce(
        (chain, artist) =>
          chain.then((alltracks = []) =>
            crawler
              .getAlbums(artist)
              .then(albums => crawler.getTracks(albums))
              .then(tracks => alltracks.concat(tracks))
          ),
        Promise.resolve()
      )
    )
    .then(tracks =>
      crawler
        .getPlaylist()
        .then(playlist => crawler.addTracks(playlist, tracks))
    )
    .then(() => console.timeEnd("Process"))
    .catch(err => {
      console.error(err);
      console.error(err.response.data);
    })
    .then(() => crawler.toggleStarted());
};

const start = async () => {
  const users = await find(usersDb);

  return users.reduce(
    (chain, user) => chain.then(() => crawl(user)),
    Promise.resolve()
  );
};

if (process.env.NODE_ENV === "production") {
  cron.schedule("0 0 * * 5", start);
}

auth.emitter.on("crawl", crawl);
auth.emitter.on("delete", id => {
  const crawler = new SpotifyCrawler(id);
  crawler.reset();
});
auth.emitter.on("reset", id => {
  const crawler = new SpotifyCrawler(id);
  crawler.reset().then(() => crawl(id));
});

auth.listen(3000, () => console.log("Listening..."));
