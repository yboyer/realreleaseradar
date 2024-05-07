const got = require('got')

module.exports = class API {
  constructor(token) {
    this.request = got.extend({
      prefixUrl: 'https://api.spotify.com/v1/',
      retry: 0,
      responseType: 'json',
      hooks: {
        beforeRequest: [
          (options) => {
            // eslint-disable-next-line no-param-reassign
            options.headers.Authorization = `Bearer ${token}`
          },
        ],
      },
    })
    ;['get', 'put', 'post'].forEach((k) => {
      const method = this.request[k]
      this.request[k] = (...args) =>
        method(...args).catch((err) => {
          console.log(err.response?.statusCode, args, err.response?.body)

          switch (err.response?.statusCode) {
            case 404:
              return {}
            case 400:
            case 429:
            case 500:
            case 501:
            case 502:
            case 504:
              return new Promise((resolve, reject) => {
                const ms =
                  Number(err.response.headers['retry-after']) * 1e3 + 1e3 || 3e3
                console.log(`Waiting ${ms / 1000} second`)
                setTimeout(
                  () => this.request[k](...args).then(resolve, reject),
                  ms
                )
              })
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
