const fs = require('fs')
const path = require('path')
const signale = require('signale')
const inquirer = require('inquirer')
const filePaths = {
  configPath: path.resolve('.', '.yuntaiconfig'),
}
const yuntaiConfig = JSON.parse(fs.readFileSync(filePaths.configPath, { encoding: 'utf-8' }))
let userAnswer = null

module.exports = (api, projectOptions, args) => {
  const prompts = [{
    name: 'moduleName',
    message: '请输入模块名称',
    type: 'input'
  }]

  // 第一次使用icon下载命令
  if (!yuntaiConfig.paths.modulePath) {
    prompts.unshift({
      name: 'createModulePath',
      when: answer => {
        if (answer.modulePath.startsWith('/')) {
          answer.modulePath = answer.modulePath.substring(1)
        }
        return !fs.existsSync(path.resolve('.', answer.modulePath))
      },
      message: '目录不存在, 是否创建?',
      type: 'confirm',
      default: true,
    })

    prompts.unshift({
      name: 'modulePath',
      message: '当前第一次使create-module工具，请输入模块初始化路径',
      type: 'input',
    })
  }

  inquirer.prompt(prompts).then(answer => {
    userAnswer = answer
    if (yuntaiConfig.paths.modulePath) {
      createModule()
    } else {
      resolveModulePath()
    }
  })
}

function resolveModulePath () {
  signale.info('第一次执行，保存模块路径')
  const modulePath = path.resolve('.', userAnswer.modulePath)
  if (fs.existsSync(modulePath)) {
    saveModulePath(userAnswer.modulePath)
    createModule()
    return
  }

  if (!fs.existsSync(modulePath) && userAnswer.createModulePath) {
    createModulePath(modulePath, modulePath)
    saveModulePath(userAnswer.modulePath)
    createModule()
  } else {
    signale.error('目标目录不存在')
    exit()
  }
}

function createModulePath (modulePath, origin) {
  // 创建对应的文件夹
  const isExistParent = fs.existsSync(path.dirname(modulePath))
  if (isExistParent) {
    fs.mkdirSync(modulePath)
    if (modulePath !== origin) {
      createIconPath(origin, origin)
    }
  } else {
    createIconPath(path.dirname(modulePath), origin)
  }
}

function saveModulePath (modulePath) {
  // 修改 当前环境中的 apiPath
  yuntaiConfig.paths.modulePath = modulePath

  // 修改 .yuntaiconfig 文件中的 modulePatj
  fs.writeFileSync(filePaths.configPath, JSON.stringify(yuntaiConfig, null, 2))
}

function createModule () {
  let moduleParent = path.resolve('.', yuntaiConfig.paths.modulePath)
  let target = moduleParent + '/' + userAnswer.moduleName

  let _api = target + '/_api'
  let _components = target + '/_components'
  let _store = target + '/_store'
  let views = target + '/views'
  let index = target + '/index.js'
  let routes = target + '/routes.js'
  let menu = target + '/routes.js'
  let indexContent = `import loadModuleData from '@/utils/load-module';\n\n` +
    `const service = loadModuleData(require.context('./', true, /\.js$/));\n\n` +
    `export default {\n` +
    `  install(Vue, loadModule, moduleName) {\n` +
    `    loadModule(service, moduleName);\n` +
    `  },\n` +
    `};\n`

  let routesContent = `export default [\n` + `];\n`

  let menuContent = `export default [\n` + `];\n`

  if (fs.existsSync(target)) {
    signale.error('模块已经存在')
  } else {
    signale.info(`准备创建模块${userAnswer.moduleName}...`)
    fs.mkdirSync(target)
    fs.mkdirSync(_api)
    fs.mkdirSync(_components)
    fs.mkdirSync(_store)
    fs.mkdirSync(views)
    fs.writeFileSync(index, indexContent)
    fs.writeFileSync(routes, routesContent)
    fs.writeFileSync(menu, menuContent)
    signale.success('创建成功')
  }
}

function exit () {
  process.exit()
}
