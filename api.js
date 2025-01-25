const axios = require('axios')
const { setTimeout } = require('timers/promises')

const MAX_RETRIES = 20
const DEFAULT_TIMEOUT = 3e3

class ApiError extends Error {
  name = 'ApiError'
  constructor(axiosError) {
    super(axiosError.message)

    if (axiosError.response) {
      const { data, config } = axiosError.response
      this.message = data?.error?.message || JSON.stringify(data)
      this.method = config.method
      this.url = config.url
      this.body = config?.data
    }
  }
}

module.exports = class API {
  constructor(token) {
    this.request = axios.create({
      baseURL: 'https://api.spotify.com/v1/',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    ;['get', 'put', 'post', 'delete'].forEach((k) => {
      const method = this.request[k]
      this.request[k] = (url, data, config = {}) =>
        method(url, data, config).catch(async (err) => {
          const statusCode = err.response?.status
          console.log(
            'Error',
            statusCode,
            err.config.method,
            err.response.request.path,
          )

          const updatedConfig = {
            ...config,
            retries: (config.retries ?? MAX_RETRIES) - 1,
          }
          if (updatedConfig.retries < 0) {
            throw new ApiError(err)
          }

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
                Number(err.response.headers['retry-after']) * 1e3 + 1e3 ||
                DEFAULT_TIMEOUT
              console.log(
                `Waiting ${ms / 1e3} second (retries left: ${updatedConfig.retries})`,
              )
              await setTimeout(ms)
              return this.request[k](url, data, updatedConfig)
            default:
              throw new ApiError(err)
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
