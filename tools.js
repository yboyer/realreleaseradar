const got = require('got')
const usersDb = require('./users/db')

const config = require('./config')

exports.refresh = async _id =>
  new Promise((resolve, reject) => {
    // eslint-disable-next-line camelcase
    usersDb.findOne({ _id }, async (_, { refresh_token }) => {
      const authOptions = {
        url: 'https://accounts.spotify.com/api/token',
        headers: {
          Authorization: `Basic ${Buffer.from(
            `${config.client_id}:${config.client_secret}`,
          ).toString('base64')}`,
        },
        form: {
          grant_type: 'refresh_token',
          refresh_token,
        },
        responseType: 'json',
      }

      const res = await got.post(authOptions).catch(reject)
      if (!res.body || !res.body.access_token) {
        reject(new Error(`No body (${res.body}) <${res.statusCode}>`))
      }
      // eslint-disable-next-line camelcase
      const { access_token } = res.body

      usersDb.update({ _id }, { $set: { access_token: res.body.access_token } })

      resolve(access_token)
    })
  })
