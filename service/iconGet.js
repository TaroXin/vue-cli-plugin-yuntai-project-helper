const signale = require('signale')
const yuntaiConfig = JSON.parse(fs.readFileSync(filePaths.configPath, { encoding: 'utf-8' }))
let userAnswer = null

module.exports = (api, projectOptions, args) => {
  const prompts = [{
    name: 'iconGroup',
    message: '请选择icon分组',
    type: 'list',
    choices: function (answer) {
      const done = this.async()
      apiRequire.getIconGroup(done, answer, yuntaiConfig)
    }
  }]

  // 第一次使用icon下载命令
  if (!yuntaiConfig.paths.iconPath) {
    prompts.unshift({
      name: 'createIconPath',
      when: answer => {
        if (answer.iconPath.startsWith('/')) {
          answer.iconPath = answer.iconPath.substring(1)
        }
        return !fs.existsSync(path.resolve('.', answer.iconPath))
      },
      message: '目录不存在, 是否创建?',
      type: 'confirm',
      default: true,
    })

    prompts.unshift({
      name: 'iconPath',
      message: '当前第一次使用build-icon工具，请设置icon的下载路径',
      type: 'input',
    })

    prompts.unshift({
      name: 'iconSession',
      message: '第一次使用build-icon工具，需要配置iconfont.cn的EGG_SESS_ICONFONT数据',
      type: 'input'
    })
  }

  signale.pending('加载API列表....')
  inquirer.prompt(prompts).then(answer => {
    userAnswer = answer
    signale.success('选择完成，准备下载...')
    if (yuntaiConfig.paths.iconPath) {
      filePaths.downloadPath = path.resolve('.', yuntaiConfig.paths.iconPath)
      filePaths.compressPath = filePaths.downloadPath + '/cache'
      download()
    } else {
      resolveIconPath()
    }
  })
}

function download () {

}

function resolveIconPath () {

}
