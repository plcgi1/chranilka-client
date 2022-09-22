'use strict'

const assert = require('assert')
const fetch = require('node-fetch')

/* eslint-disable */
const url = require('url')
/* eslint-enable */

module.exports = class ChranilkaClient {
  constructor(options = {}) {
    this.api = options.API_URL
    this.username = options.API_USER
    this.password = options.API_PASSWORD
  }

  async initialize() {
    if (process.env.NODE_ENV === 'test') {
      return true
    }

    const response = await fetch(`${this.api}/api/auth`, {
      method: 'POST',
      body: JSON.stringify({
        email: this.username,
        password: this.password,
      }),
      headers: {
        'content-type': 'application/json',
      },
    })
    const data = await response.json()

    assert(
      data.token,
      `Error to get auth token: api url: ${this.api}.response: ${JSON.stringify(data)}`
    ) // we can't start taking without JWT

    this.token = data.token.token
  }

  authHeaders() {
    return {
      headers: { Authorization: `Bearer ${this.token}` },
    }
  }

  getUrl(path, options = {}) {
    const result = new URL(`${this.api}${path}`)

    Object.keys(options).forEach((option) => {
      result.searchParams.append(option, options[option])
    })
    if (options.asObject) {
      return result
    }

    return result.toString()
  }

  async request(opts = { method: 'get', params: {} }, options = {}) {
    const url = this.getUrl(opts.path, options)

    const authHeaders = this.authHeaders()
    let result

    switch (opts.method) {
      case 'get':
      case 'delete':
        result = await fetch(url, { method: opts.method, params: opts.params, ...authHeaders })
        break
      case 'patch':
        result = await fetch(url, {
          method: 'patch',
          body: JSON.stringify(opts.params),
          headers: {
            'content-type': 'application/json',
            ...authHeaders.headers,
          },
        })
        break
      case 'post':
        result = await fetch(url, {
          method: 'post',
          body: JSON.stringify(opts.params),
          headers: {
            'content-type': 'application/json',
            ...authHeaders.headers,
          },
        })

        break
      default:
        break
    }
    const text = await result.text()
    const json = JSON.parse(text || '{}')

    if (json.name && result.code === 401 && /token-expired/i.test(json.name)) {
      // {
      //   "name": "token-expired",
      //   "message": "Auth expired"
      // }
      await this.initialize()
      return this.request(opts, options)
    }

    return json
  }

  getKey(keyId, options = {}) {
    return this.request(
      {
        method: 'get',
        path: `/api/key/${keyId}`,
      },
      options
    )
  }
}
