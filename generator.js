module.exports = (api, options, rootOptions) => {
  // 修改 `package.json` 里的字段
  api.extendPackage({
    scripts: {
      'build:api': 'vue-cli-service nei-api-get'
    }
  })

  if (options.S_INFO && options.KOA_SID && options.KOA_SID_SIG) {
    api.render('./template', options)
  }
}
