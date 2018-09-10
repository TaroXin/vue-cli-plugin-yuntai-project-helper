const fs = require('fs')
const path = require('path')
const http = require('http')
const compressing = require('compressing')
const signale = require('signale')
const inquirer = require('inquirer')
const apiRequire = require('../utils/apiRequire')
const filePaths = {
  configPath: path.resolve('.', '.yuntaiconfig'),
  downloadPath: '',
  compressPath: '',
  filename: '/cache.zip',
}
const yuntaiConfig = JSON.parse(fs.readFileSync(filePaths.configPath, { encoding: 'utf-8' }))
const downloadUrl = 'http://www.iconfont.cn/api/project/download.zip?'
let userAnswer = null

module.exports = (api, projectOptions, args) => {
  const prompts = [{
    name: 'iconGroup',
    message: '请选择icon分组',
    type: 'list',
    choices: function (answer) {
      const done = this.async()
      if (!yuntaiConfig.api_cookies.EGG_SESS_ICONFONT) {
        yuntaiConfig.api_cookies.EGG_SESS_ICONFONT = answer.iconSession
        yuntaiConfig.api_cookies.ctoken = answer.ctoken
      }

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
      name: 'iconCtoken',
      message: '第一次使用build-icon工具，需要配置iconfont.cn的ctoken数据',
      type: 'input'
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
  let { iconGroup } = userAnswer

  if (!fs.existsSync(filePaths.downloadPath)) {
    signale.info('cache目录不存在，创建目录')
    createIconPath(filePaths.downloadPath, filePaths.downloadPath)
  } else {
    signale.info('cache目录存在，删除目录')
    rmCacheDir(filePaths.compressPath)
  }

  signale.info('下载地址: ' + downloadUrl + 'ctoken=' + yuntaiConfig.api_cookies.ctoken + '&pid=' + iconGroup)
  let file = fs.createWriteStream(filePaths.downloadPath + filePaths.filename);

  let interactive = new signale.Signale({interactive: true, scope: 'download'})
  interactive.await('正在下载')
  const options = {
    hostname: 'www.iconfont.cn',
    port: 80,
    path: `/api/project/download.zip?ctoken=${yuntaiConfig.api_cookies.ctoken}&pid=${iconGroup}`,
    method: 'GET',
    headers: {
        'Cookie': `EGG_SESS_ICONFONT=${yuntaiConfig.api_cookies.EGG_SESS_ICONFONT}`
    }
  }

  http.get(options, function (res) {
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
  mergeSelectedFiles()
}

// 获取当前选择的文件与已经存在的文件进行合并
function mergeSelectedFiles () {
  const interactive = new signale.Signale({interactive: true, scope: 'merge'})
  interactive.await('准备合并文件')
  const sourceDir = fs.readdirSync(filePaths.compressPath)[0]
  const sourceFiles = ['iconfont.css', 'iconfont.ttf', 'demo_fontclass.html']

  sourceFiles.forEach(fileName => {
    let source = filePaths.compressPath + '/' + sourceDir + '/' + fileName
    if (fs.existsSync(source)) {
      let target = filePaths.downloadPath + '/' + fileName
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
}

function resolveIconPath () {
  signale.info('第一次执行，保存icon下载路径')
  const iconPath = path.resolve('.', userAnswer.iconPath)
  if (fs.existsSync(iconPath)) {
    saveIconPath(userAnswer.iconPath)
    download()
    return
  }

  if (!fs.existsSync(iconPath) && userAnswer.createIconPath) {
    createIconPath(iconPath, iconPath)
    saveIconPath(userAnswer.iconPath)
    download()
  } else {
    signale.error('目标目录不存在')
  }
}

function createIconPath (apiPath, origin) {
  // 创建对应的文件夹
  const isExistParent = fs.existsSync(path.dirname(apiPath))
  if (isExistParent) {
    fs.mkdirSync(apiPath)
    if (apiPath !== origin) {
      createIconPath(origin, origin)
    }
  } else {
    createIconPath(path.dirname(apiPath), origin)
  }
}

function saveIconPath (iconPath) {
  // 修改 当前环境中的 apiPath
  yuntaiConfig.paths.iconPath = iconPath
  yuntaiConfig.api_cookies.EGG_SESS_ICONFONT = userAnswer.iconSession
  yuntaiConfig.api_cookies.ctoken = userAnswer.ctoken

  filePaths.downloadPath = path.resolve('.', yuntaiConfig.paths.iconPath)
  filePaths.compressPath = filePaths.downloadPath + '/cache'
  // 修改 .yuntaiconfig 文件中的 apiPath
  fs.writeFileSync(filePaths.configPath, JSON.stringify(yuntaiConfig, null, 2))
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

function exit () {
  process.exit()
}
