const fs = require('fs')
const path = require('path')

module.exports = (api, options, rootOptions) => {
  // 修改 `package.json` 里的字段
  api.extendPackage({
    scripts: {
      'build:api': 'vue-cli-service nei-api-get',
      'update:api': 'vue-cli-service nei-api-update',
      'build:icon': 'vue-cli-service icon-get'
    }
  })

  // 配置 .gitignore 文件, 忽略 .yuntaiconfig 文件
  const gitignorePath = path.resolve('.', '.gitignore')
  let content = '.yuntaiconfig'
  if (fs.existsSync(gitignorePath)) {
    fs.appendFileSync(gitignorePath, content)
  } else {
    fs.writeFileSync(gitignorePath, content)
  }

  if (options.S_INFO && options.KOA_SID && options.KOA_SID_SIG) {
    api.render('./template', options)
  }
}
