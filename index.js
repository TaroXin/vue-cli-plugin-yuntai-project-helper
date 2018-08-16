const neiApiGet = require('./service/neiApiGet')

module.exports = (api, projectOptions) => {
  api.registerCommand('nei-api-get', args => {
    neiApiGet(api, projectOptions, args)
  })
}
