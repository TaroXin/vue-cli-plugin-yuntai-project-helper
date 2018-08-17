const fs = require('fs')
const path = require('path')
const inquirer = require('inquirer')
const http = require('http')
const compressing = require('compressing')
const signale = require('signale')
const apiRequire = require('../utils/apiRequire')
const downloadUrl = 'http://NeiDebug.youcaihua.net:8081/Nei/GenCode?key='
const filePaths = {
  cookiePath: path.resolve('.', '.neicookie'),
  downloadPath: path.resolve('.', 'api/'),
  compressPath: path.resolve('.', 'api/cache'),
  filename: '/cache.zip',
}
let userAnswer = null

module.exports = (api, projectOptions, args) => {
  const result = fs.readFileSync(filePaths.cookiePath, { encoding: 'utf-8' })
  const neiCookie = JSON.parse(result)
  signale.pending('加载API列表...')

  inquirer.prompt([{
    name: 'apiGroup',
    message: '请选择API分组',
    type: 'list',
    choices: function (answer) {
      const done = this.async()
      apiRequire.getApiGroup(done, answer, neiCookie)
    }
  }, {
    name: 'apiGroupDetail',
    message: '请选择需要下载的API模块',
    type: 'list',
    choices: function (answer) {
      const done = this.async()
      apiRequire.getApiGroupDetail(done, answer, neiCookie)
    }
  }, {
    name: 'apiInterfaceGroup',
    message: '请选择需要应用的API模块文件名',
    type: 'checkbox',
    choices: function (answer) {
      const done = this.async()
      apiRequire.getApiInterface(done, answer, neiCookie)
    }
  }]).then(answer => {
    userAnswer = answer
    signale.success('选择完成，准备下载...')
    if (answer.apiInterfaceGroup.length === 0) {
      signale.success('未选择项目，执行成功')
    } else {
      download()
    }
  })
}

function download (answer) {
  let { apiInterfaceGroup, apiGroupDetail } = userAnswer

  if (!fs.existsSync(filePaths.downloadPath)) {
    signale.info('cache目录不存在，创建目录')
    fs.mkdirSync(filePaths.downloadPath)
  } else {
    signale.info('cache目录存在，删除目录')
    rmCacheDir(filePaths.compressPath)
  }

  signale.info('下载地址: ' + downloadUrl + apiGroupDetail.toolKey)
  let file = fs.createWriteStream(filePaths.downloadPath + filePaths.filename);

  signale.pending('下载中...')
  http.get(downloadUrl + apiGroupDetail.toolKey, function (res) {
    res.on('data', data => {
      file.write(data);
    });

    res.on('progress', data => {
      console.log(data)
    })

    res.on('end', _ => {
      file.end();
      signale.success('Zip文件下载成功, 准备解压')
      unzipCache(filePaths.downloadPath + filePaths.filename)
    })
  })
}

function unzipCache (path) {
  signale.pending('解压中...')
  compressing.zip.uncompress(path, filePaths.compressPath).then(_ => {
    signale.success('解压成功')
    rmCacheFile()
    resolveFiles()
  }).catch(err => {
    signale.error(err)
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
    }
  } else {
    signale.error('不存在目标文件，停止执行')
    rmCacheDir(filePaths.compressPath)
    signale.success('删除缓存文件夹成功')
  }
}

// 获取当前选择的文件与已经存在的文件进行合并
function mergeSelectedFiles (targetDirName) {
  let { apiInterfaceGroup } = userAnswer
  // signale.info(apiInterfaceGroup)
  signale.pending('准备合并文件')
  apiInterfaceGroup.forEach(interfaceName => {
    let source = filePaths.compressPath + '/RPC_JS/v1/' + targetDirName + '/ES6_' + interfaceName + '.js'
    let target = filePaths.downloadPath + '/' + interfaceName + '.js'
    mergeFile(target, source)
  })

  rmCacheDir(filePaths.compressPath)
  signale.success('执行成功, 完成!')
}

// 合并文件
function mergeFile (target, source) {
  if (!fs.existsSync(target)) {
    signale.info('目标不存在, 执行copy')
    fs.copyFileSync(source, target)
  } else {
    signale.info('目标存在, 执行merge')
  }
}

function rmCacheFile () {
  fs.unlinkSync(filePaths.downloadPath + filePaths.filename)
  signale.success('缓存Zip文件删除成功')
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
