const axios = require('axios')
const { setTimeout } = require('timers/promises')

module.exports = class API {
  constructor(token) {
    this.request = axios.create({
      baseURL: 'https://api.spotify.com/v1/',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    ;['get', 'put', 'post'].forEach((k) => {
      const method = this.request[k]
      this.request[k] = (...args) =>
        method(...args).catch(async (err) => {
          const statusCode = err.response?.status
          console.log('Error', statusCode, err.response.request.path)
          switch (statusCode) {
            case 404:
              return {}
            case 400:
            case 403:
            case 429:
            case 500:
            case 501:
            case 502:
            case 504:
              const ms =
                Number(err.response.headers['retry-after']) * 1e3 + 1e3 || 3e3
              console.log(`Waiting ${ms / 1000} second`)
              await setTimeout(ms)
              return this.request[k](...args)
            default:
              throw err
          }
        })
    })
  }

  get get() {
    return this.request.get
  }
  get post() {
    return this.request.post
  }
  get put() {
    return this.request.put
  }
  get delete() {
    return this.request.delete
  }
}
