const fs = require('fs')
const path = require('path')
const inquirer = require('inquirer')
const http = require('http')
const unzip = require('unzip')
const apiRequire = require('../utils/apiRequire')
const downloadUrl = 'http://NeiDebug.youcaihua.net:8081/Nei/GenCode?key='
const filePaths = {
  cookiePath: path.resolve('.', '.neicookie'),
  downloadPath: path.resolve('.', 'api/'),
  filename: '/cache.zip',
}

module.exports = (api, projectOptions, args) => {
  const result = fs.readFileSync(filePaths.cookiePath, { encoding: 'utf-8' })
  const neiCookie = JSON.parse(result)
  console.log('正在加载, 请稍候...')

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
    if (answer.apiInterfaceGroup.length === 0) {
      console.log('Successful !')
    } else {
      download(answer)
    }
  })
}

function download (answer) {
  let { apiInterfaceGroup, apiGroupDetail } = answer

  if (!fs.existsSync(filePaths.downloadPath)) {
    console.log('创建文件夹')
    fs.mkdirSync(filePaths.downloadPath)
  }

  console.log('下载地址: ' + downloadUrl + apiGroupDetail.toolKey)
  let file = fs.createWriteStream(filePaths.downloadPath + filePaths.filename);

  http.get(downloadUrl + apiGroupDetail.toolKey, function (res) {
    res.on('data', data => {
      file.write(data);
    });

    res.on('progress', data => {
      console.log(data)
    })

    res.on('end', _ => {
      file.end();
      console.log('下载成功');
      unzipCache(filePaths.downloadPath + filePaths.filename)
    })
  })
}

function unzipCache (path) {
  console.log('文件解压缩...')
  const file = fs.createReadStream(path)
  file.pipe(unzip.Extract({ path: 'unarchive' }))
  console.log('解压成功')
}
