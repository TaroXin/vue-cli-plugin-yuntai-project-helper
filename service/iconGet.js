const fs = require('fs')
const path = require('path')
const http = require('http')
const compressing = require('compressing')
const signale = require('signale')
const inquirer = require('inquirer')
const cheerio = require('cheerio')
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

  prompts.unshift({
    name: 'iconPath',
    when: answer => {
      return answer.iconTarget === 'css' && !yuntaiConfig.paths.iconPath
    },
    message: '当前第一次使用build-icon工具，请设置icon的下载路径',
    type: 'input',
  })

  prompts.unshift({
    name: 'svgPath',
    when: answer => {
      return answer.iconTarget === 'svg' && !yuntaiConfig.paths.svgPath
    },
    message: '当前第一次使用build-icon工具，请设置svg的下载路径',
    type: 'input',
  })

  if (!yuntaiConfig.api_cookies.EGG_SESS_ICONFONT) {
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

  prompts.unshift({
    name: 'iconTarget',
    message: '请选择icon生成策略',
    type: 'list',
    choices: ['css', 'svg']
  })

  signale.pending('加载API列表....')
  inquirer.prompt(prompts).then(answer => {
    userAnswer = answer
    signale.success('选择完成，准备下载...')
    if (userAnswer.iconTarget === 'css' && yuntaiConfig.paths.iconPath) {
      filePaths.downloadPath = path.resolve('.', yuntaiConfig.paths.iconPath)
      filePaths.compressPath = filePaths.downloadPath + '/cache'
      download()
    } else if (userAnswer.iconTarget === 'svg' && yuntaiConfig.paths.svgPath) {
      filePaths.downloadPath = path.resolve('.', yuntaiConfig.paths.svgPath)
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
  let sourceFiles = null
  if (userAnswer.iconTarget === 'css') {
    sourceFiles = ['iconfont.css', 'iconfont.ttf', 'demo_fontclass.html']
  } else if (userAnswer.iconTarget === 'svg') {
    sourceFiles = ['iconfont.js', 'demo_symbol.html']
  }

  sourceFiles.forEach(fileName => {
    let source = filePaths.compressPath + '/' + sourceDir + '/' + fileName
    if (fs.existsSync(source)) {
      let target = filePaths.downloadPath + '/' + fileName
      mergeFile(target, source)
    } else {
      interactive.error('预设文件地址' + source + '不存在, 跳过执行')
    }
  })

  if (userAnswer.iconTarget === 'css') {
    formatIconCss(filePaths.downloadPath + '/iconfont.css')
  }

  generateIconJson(sourceFiles[sourceFiles.length - 1], filePaths.downloadPath)

  interactive.success('合并完成')

  rmCacheDir(filePaths.compressPath)
  signale.success('执行成功, 完成!')
  exit()
}

function formatIconCss (iconCssPath) {
  iconCssPath = path.resolve('.', iconCssPath)
  let content = fs.readFileSync(iconCssPath).toString()
  let needReplace = content.substring(0, content.indexOf('}', 200) + 2)
  let replaceStr =
    `/* stylelint-disable */\n` +
    `@font-face {\n` +
    `  font-family: "iconfont";\n` +
    `  src: ${needReplace.substring(needReplace.indexOf("url('iconfont.ttf"), needReplace.indexOf("format('truetype')") + 18)};\n` +
    `}\n`

  content = content.replace(needReplace, replaceStr)
  fs.writeFileSync(iconCssPath, content)
}

function generateIconJson (iconPath, parent) {
  let html = path.resolve('.', parent + '/' + iconPath)
  let options = { decodeEntities: false }
  let $ = cheerio.load(fs.readFileSync(html), options)
  let iconList = $('.icon_lists').eq(0).find('li')
  let iconContent = `export default [$REPLACE];\n`
  let iconObjects = []
  iconList.each((index, element) => {
    iconObjects.push(
      `{\n` +
      `  name: '${$(element).find('.name').eq(0).html()}',\n` +
      `  fontclass: '${$(element).find('.fontclass').eq(0).html()}',\n` +
      `}`
    )
  })

  let replaceStr = ''
  iconObjects.forEach(content => {
    replaceStr += content + ', '
  })
  replaceStr = replaceStr.substring(0, replaceStr.lastIndexOf(','))
  iconContent = iconContent.replace('$REPLACE', replaceStr)
  fs.writeFileSync(parent + '/icons.js', iconContent)
}

// 合并文件
function mergeFile (target, source) {
  fs.copyFileSync(source, target)
}

function resolveIconPath () {
  signale.info('第一次执行，保存icon下载路径')
  let iconPath
  let pathStr
  if (userAnswer.iconTarget === 'css') {
    pathStr = userAnswer.iconPath
    iconPath = path.resolve('.', userAnswer.iconPath)
  } else {
    pathStr = userAnswer.svgPath
    iconPath = path.resolve('.', userAnswer.svgPath)
  }

  if (fs.existsSync(iconPath)) {
    saveIconPath(pathStr)
    download()
    return
  }

  if (!fs.existsSync(iconPath)) {
    createIconPath(iconPath, iconPath)
    saveIconPath(pathStr)
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
  if (userAnswer.iconTarget === 'css') {
    yuntaiConfig.paths.iconPath = iconPath
    filePaths.downloadPath = path.resolve('.', yuntaiConfig.paths.iconPath)
  } else {
    yuntaiConfig.paths.svgPath = iconPath
    filePaths.downloadPath = path.resolve('.', yuntaiConfig.paths.svgPath)
  }

  yuntaiConfig.api_cookies.EGG_SESS_ICONFONT = userAnswer.iconSession || yuntaiConfig.api_cookies.EGG_SESS_ICONFONT
  yuntaiConfig.api_cookies.ctoken = userAnswer.iconCtoken || yuntaiConfig.api_cookies.ctoken
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
