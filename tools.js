const got = require('got')
const usersDb = require('./users/db')

const config = require('./config')

exports.refresh = async (_id) => {
  const { refresh_token } = await usersDb.findOneAsync({ _id })
  const authOptions = {
    url: 'https://accounts.spotify.com/api/token',
    headers: {
      Authorization: `Basic ${Buffer.from(
        `${config.clientId}:${config.clientSecret}`
      ).toString('base64')}`,
    },
    form: {
      grant_type: 'refresh_token',
      refresh_token,
    },
    responseType: 'json',
  }

  try {
    const res = await got.post(authOptions)
    if (!res.body || !res.body.access_token) {
      throw new Error(`No body (${res.body}) <${res.statusCode}>`)
    }
    // eslint-disable-next-line camelcase
    const { access_token } = res.body

    await usersDb.updateAsync(
      { _id },
      { $set: { access_token: res.body.access_token } }
    )

    return access_token
  } catch (e) {
    if (e.response) {
      throw new Error(e.response.body)
    }
    throw e
  }
}
