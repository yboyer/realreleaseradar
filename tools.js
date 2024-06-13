const axios = require('axios')
const usersDb = require('./users/db')

const config = require('./config')

exports.refresh = async (_id) => {
  const { refresh_token } = await usersDb.findOneAsync({ _id })

  try {
    const res = await axios.post(
      'https://accounts.spotify.com/api/token',
      {
        grant_type: 'refresh_token',
        refresh_token,
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
    if (!res.data || !res.data.access_token) {
      throw new Error(`No data (${res.data}) <${res.statusCode}>`)
    }
    // eslint-disable-next-line camelcase
    const { access_token } = res.data

    await usersDb.updateAsync({ _id }, { $set: { access_token: access_token } })

    return access_token
  } catch (e) {
    if (e.response) {
      throw new Error(
        e.response.data.error_description ||
          e.response.data.error ||
          JSON.stringify(e.response.data),
      )
    }
    throw e
  }
}
