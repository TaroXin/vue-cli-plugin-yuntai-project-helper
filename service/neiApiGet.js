const fs = require('fs')
const path = require('path')
const inquirer = require('inquirer')
const http = require('http')
const request = require('superagent')
const compressing = require('compressing')
const signale = require('signale')
const apiRequire = require('../utils/apiRequire')
const downloadUrl = 'http://NeiDebug.youcaihua.net:8081/Nei/GenCode?key='
const filePaths = {
  configPath: path.resolve('.', '.yuntaiconfig'),
  downloadPath: '',
  compressPath: '',
  filename: '/cache.zip',
}
const neiUrls = {
  interfaceApi: 'https://nei.netease.com/api/interfaces/',
}

const yuntaiConfig = JSON.parse(fs.readFileSync(filePaths.configPath, { encoding: 'utf-8' }))
let userAnswer = null

module.exports = (api, projectOptions, args) => {
  const prompts = [{
    name: 'apiDownloadPath',
    message: `重新指定下载路径请输入, 否则请点击回车${yuntaiConfig.paths.apiPath ? '(' + yuntaiConfig.paths.apiPath + ')' : ''}: `,
    type: 'input',
  }, {
    name: 'apiTarget',
    message: '请选择API生成策略',
    type: 'list',
    choices: [
      'Class',
      'Object'
    ],
  }, {
    name: 'apiGroup',
    message: '请选择API分组',
    type: 'list',
    choices: function (answer) {
      const done = this.async()
      apiRequire.getApiGroup(done, answer, yuntaiConfig)
    }
  }, {
    name: 'apiGroupDetail',
    message: '请选择需要下载的API模块',
    type: 'list',
    choices: function (answer) {
      const done = this.async()
      apiRequire.getApiGroupDetail(done, answer, yuntaiConfig)
    }
  }, {
    name: 'apiInterfaceGroup',
    message: '请选择需要应用的API模块文件名',
    type: 'checkbox',
    choices: function (answer) {
      const done = this.async()
      apiRequire.getApiInterface(done, answer, yuntaiConfig)
    }
  }]

  // 判断这里是不是第一次进来，判断依据是当前没有apiPath的下载地址
  if (!yuntaiConfig.paths.apiPath) {
    prompts.unshift({
      name: 'createApiPath',
      when: answer => {
        if (answer.apiPath.startsWith('/')) {
          answer.apiPath = answer.apiPath.substring(1)
        }
        return !fs.existsSync(path.resolve('.', answer.apiPath))
      },
      message: '目录不存在, 是否创建?',
      type: 'confirm',
      default: true,
    })

    prompts.unshift({
      name: 'apiPath',
      message: '当前第一次使用build-api工具，请设置api的下载路径',
      type: 'input',
    })
  }

  signale.pending('加载API列表...')
  inquirer.prompt(prompts).then(answer => {
    userAnswer = answer
    signale.success('选择完成，准备下载...')
    if (answer.apiInterfaceGroup.length === 0) {
      signale.success('未选择项目，执行成功')
    } else {
      if (yuntaiConfig.paths.apiPath) {
        filePaths.downloadPath = path.resolve('.', yuntaiConfig.paths.apiPath)
        filePaths.compressPath = filePaths.downloadPath + '/cache'
        download()
      } else {
        resolveApiPath()
      }
    }
  })
}

// 创建目录
function resolveApiPath () {
  signale.info('第一次执行，保存api下载路径')
  const apiPath = path.resolve('.', userAnswer.apiPath)
  if (fs.existsSync(apiPath)) {
    saveApiPath(userAnswer.apiPath)
    download()
    return
  }

  if (!fs.existsSync(apiPath) && userAnswer.createApiPath) {
    createApiPath(apiPath, apiPath)
    saveApiPath(userAnswer.apiPath)
    download()
  } else {
    signale.error('目标目录不存在')
  }
}

function createApiPath (apiPath, origin) {
  // 创建对应的文件夹
  const isExistParent = fs.existsSync(path.dirname(apiPath))
  if (isExistParent) {
    fs.mkdirSync(apiPath)
    if (apiPath !== origin) {
      createApiPath(origin, origin)
    }
  } else {
    createApiPath(path.dirname(apiPath), origin)
  }
}

function saveApiPath (apiPath) {
  // 修改 当前环境中的 apiPath
  yuntaiConfig.paths.apiPath = apiPath
  filePaths.downloadPath = path.resolve('.', yuntaiConfig.paths.apiPath)
  filePaths.compressPath = filePaths.downloadPath + '/cache'
  // 修改 .yuntaiconfig 文件中的 apiPath
  fs.writeFileSync(filePaths.configPath, JSON.stringify(yuntaiConfig, null, 2))
}

// 下载文件
function download () {
  let { apiInterfaceGroup, apiGroupDetail, apiDownloadPath } = userAnswer
  // 重新定义 downloadPaht
  if (apiDownloadPath) {
    filePaths.downloadPath = apiDownloadPath
    if (!fs.existsSync(apiDownloadPath)) {
      createApiPath(apiDownloadPath, apiDownloadPath)
    }
  }

  if (!fs.existsSync(filePaths.downloadPath)) {
    signale.info('cache目录不存在，创建目录')
    createApiPath(filePaths.downloadPath, filePaths.downloadPath)
  } else {
    signale.info('cache目录存在，删除目录')
    rmCacheDir(filePaths.compressPath)
  }

  if (userAnswer.apiTarget === 'Class') {
    // 生成传统的 Class 格式
    signale.info('下载地址: ' + downloadUrl + apiGroupDetail.toolKey)
    let file = fs.createWriteStream(filePaths.downloadPath + filePaths.filename);

    let interactive = new signale.Signale({interactive: true, scope: 'download'})
    interactive.await('正在下载')
    http.get(downloadUrl + apiGroupDetail.toolKey, function (res) {
      res.on('data', data => {
        file.write(data);
      });

      res.on('progress', data => {
        console.log(data)
      })

      res.on('end', _ => {
        file.end();
        interactive.success('文件下载成功, 准备解压')
        interactive = null
        unzipCache(filePaths.downloadPath + filePaths.filename)
      })
    })
  } else if (userAnswer.apiTarget === 'Object') {
    // 生成最新的 Object 格式
    generateObjectTargetApi()
  } else {
    signale.error('暂时不支持该格式下载')
  }
}

function unzipCache (path) {
  let interactive = new signale.Signale({interactive: true, scope: 'unzip'})
  interactive.await('准备解压')
  compressing.zip.uncompress(path, filePaths.compressPath).then(_ => {
    interactive.success('解压成功')
    rmCacheFile()
    resolveFiles()
  }).catch(err => {
    interactive.error(err)
  })
}

// 解析文件，查找是否存在目标文件夹
function resolveFiles () {
  let { apiGroupDetail } = userAnswer
  // 目标文件夹名称
  let targetDirName = apiGroupDetail.name.substring(apiGroupDetail.name.indexOf('-') + 1, apiGroupDetail.name.indexOf('('))

  const isExistJsFiles = fs.existsSync(filePaths.compressPath + '/RPC_JS')
  if (isExistJsFiles) {
    const isExistTargetDir = fs.existsSync(filePaths.compressPath + '/RPC_JS/v1/' + targetDirName)
    if (isExistTargetDir) {
      mergeSelectedFiles(targetDirName)
    } else {
      signale.error('不存在目标文件，停止执行')
      rmCacheDir(filePaths.compressPath)
      signale.success('删除缓存文件夹成功')
      exit()
    }
  } else {
    signale.error('不存在目标文件，停止执行')
    rmCacheDir(filePaths.compressPath)
    signale.success('删除缓存文件夹成功')
    exit()
  }
}

// 获取当前选择的文件与已经存在的文件进行合并
function mergeSelectedFiles (targetDirName) {
  const interactive = new signale.Signale({interactive: true, scope: 'merge'})
  let { apiInterfaceGroup } = userAnswer
  // signale.info(apiInterfaceGroup)
  interactive.await('准备合并文件')
  apiInterfaceGroup.forEach(interfaceGroup => {
    let interfaceName = interfaceGroup.name
    let source = filePaths.compressPath + '/RPC_JS/v1/' + targetDirName + '/ES6_' + interfaceName + '.js'
    if (fs.existsSync(source)) {
      let target = filePaths.downloadPath + '/' + interfaceName + '.js'
      mergeFile(target, source)
    } else {
      interactive.error('预设文件地址' + source + '不存在, 跳过执行')
    }
  })
  interactive.success('合并完成')

  rmCacheDir(filePaths.compressPath)
  signale.success('执行成功, 完成!')
  exit()
}

// 合并文件
function mergeFile (target, source) {
  fs.copyFileSync(source, target)
  // if (!fs.existsSync(target)) {
  //   signale.info('目标不存在, 执行copy')
  //   fs.copyFileSync(source, target)
  // } else {
  //   signale.info('目标存在, 执行merge')
  // }
}

function rmCacheFile () {
  fs.unlinkSync(filePaths.downloadPath + filePaths.filename)
}

function rmCacheDir (path) {
  var files = [];
  if( fs.existsSync(path) ) {
    files = fs.readdirSync(path);
    files.forEach(function(file,index){
      let curPath = path + "/" + file;
      if(fs.statSync(curPath).isDirectory()) { // recurse
        rmCacheDir(curPath);
      } else { // delete file
        fs.unlinkSync(curPath);
      }
    });
    fs.rmdirSync(path);
  }
}

// 生成最新版本 Object 格式
function generateObjectTargetApi () {
  signale.info('Object格式Api生成策略')
  userAnswer.apiInterfaceGroup.forEach(group => {
    let { name, id, children } = group
    let fileContent = 'export default [$REPLACE];\n'
    let childLength = children.length
    let currentSuccessLen = 0
    let childrenObjects = []
    children.forEach(childId => {
      let childContent = ''
      request
        .get(neiUrls.interfaceApi + childId)
        .set(yuntaiConfig.base_headers)
        .set('Cookie', generateCookie(yuntaiConfig.cookies))
        .end((err, res) => {
          let result = res.body.result
          if (res.body.code === 200) {
            let name = result.path.substring(result.path.lastIndexOf('/') + 1)
            name = name.substring(0, 1).toLowerCase() + name.substring(1)
            let params = result.params.inputs.map(param => {
              return `\n    ${param.name}: ${!!param.required}, // typeName: ${param.typeName}  desc:${' ' + param.description}`
            })
            let paramsStr = ''
            params.forEach(param => {
              paramsStr += param
            })

            childContent += '{\n' +
              `  name: '${name}',\n` +
              `  method: '${result.method}',\n` +
              `  desc: '${result.description || result.name}',\n` +
              `  path: '${result.path}',\n` +
              `  mockPath: '${result.path}',\n` +
              `  params: {${paramsStr}\n  },\n` +
              `}`
            childrenObjects.push(childContent)
          } else {
            signale.error('获取失败，name:' + name)
          }

          currentSuccessLen += 1
          if (currentSuccessLen === childLength) {
            generateObjectTargetFile(name, fileContent, childrenObjects)
          }
        })
    });
  })
}

function generateObjectTargetFile (name, content, children) {
  signale.info(name + '文件请求完成, 准备生成文件...')
  name = name.substring(0, 1).toLowerCase() + name.substring(1)
  let childContent = ''
  children.forEach(child => {
    childContent += child + ', '
  })
  childContent = childContent.substring(0, childContent.lastIndexOf(','))

  content = content.replace('$REPLACE', childContent)
  let target = filePaths.downloadPath + '/' + name + '.js'
  if (fs.existsSync(target)) {
    fs.unlinkSync(target)
  }

  fs.writeFileSync(target, content)
  signale.success(name + '.js 写入完成')
}

function generateCookie (cookies) {
  return Object.keys(cookies).map(key => {
      return key + '=' + cookies[key]
  }).join('; ')
}

function exit () {
  process.exit()
}
