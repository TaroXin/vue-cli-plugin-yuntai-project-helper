const neiApiGet = require('./service/neiApiGet')
const neiApiUpdate = require('./service/neiApiUpdate')
const iconGet = require('./service/iconGet')
const createModule = require('./service/createModule')

module.exports = (api, projectOptions) => {
  api.registerCommand('nei-api-get', args => {
    neiApiGet(api, projectOptions, args)
  })

  api.registerCommand('nei-api-update', args => {
    neiApiUpdate(api, projectOptions, args)
  })

  api.registerCommand('icon-get', args => {
    iconGet(api, projectOptions, args)
  })

  api.registerCommand('create-module', args => {
    createModule(api, projectOptions, args)
  })
}
