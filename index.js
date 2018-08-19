const neiApiGet = require('./service/neiApiGet')
const neiApiUpdate = require('./service/neiApiUpdate')

module.exports = (api, projectOptions) => {
  api.registerCommand('nei-api-get', args => {
    neiApiGet(api, projectOptions, args)
  })

  api.registerCommand('nei-api-update', args => {
    neiApiUpdate(api, projectOptions, args)
  })
}
