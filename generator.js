module.exports = (api, options, rootOptions) => {
  // 修改 `package.json` 里的字段
  api.extendPackage({
    scripts: {
      'build:api': 'vue-cli-service nei-api-get'
    }
  })

  // 配置 .gitignore 文件, 忽略 .yuntaiconfig 文件
  

  if (options.S_INFO && options.KOA_SID && options.KOA_SID_SIG) {
    api.render('./template', options)
  }
}
