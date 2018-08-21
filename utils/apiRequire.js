const request = require('superagent')
const neiUrls = {
    recentApi: 'https://nei.netease.com/api/projects/?recent',
    progroupsApi: 'https://nei.netease.com/api/progroups/',
    interfaceApi: 'https://nei.netease.com/api/interfaces/?pid=',
    iconGroupApi: 'http://www.iconfont.cn/api/user/myprojects.json?',
}

function generateCookie (cookies) {
    return Object.keys(cookies).map(key => {
        return key + '=' + cookies[key]
    }).join('; ')
}

module.exports = {
    getApiGroup (done, answer, cookies) {
      request
        .get(neiUrls.progroupsApi)
        .query('recent', '')
        .set(cookies.base_headers)
        .set('Cookie', generateCookie(cookies.cookies))
        .end((err, res) => {
          if (res.body.code === 200) {
            done(null, res.body.result.map(progroup => {
              return {
                name: progroup.name,
                value: progroup.id,
                short: progroup.name
              }
            }))
          } else {
            done(res.body.message)
          }
        })
    },

    getApiGroupDetail (done, answer, cookies) {
      let apiGroup = answer.apiGroup

      request
        .get(neiUrls.progroupsApi + apiGroup)
        .set(cookies.base_headers)
        .set('Cookie', generateCookie(cookies.cookies))
        .end((err, res) => {
          if (res.body.code === 200) {
            done(null, res.body.result.projects.map(project => {
              return {
                name: project.name,
                value: {
                  id:  project.id,
                  toolKey: project.toolKey,
                  name: project.name,
                },
                short: project.name
              }
            }))
          } else {
            done(res.body.message)
          }
        })
    },

    getApiInterface (done, answer, cookies) {
      request
        .get(neiUrls.iconGroupApi + 't=' + Date.now() + '&ctoken=' + cookies.api_cookies.ctoken)
        .set(cookies.api_base_headers)
        .set('Cookie', generateCookie(cookies.api_cookies))
        .end((err, res) => {
          if (res.body.code === 200) {
            const interfaceGroup = []
            res.body.result.forEach(interface => {
              const hasGroup = interfaceGroup.some(item => item.groupId === interface.groupId)
              if (!hasGroup) {
                interfaceGroup.push({
                  name: `${interface.group.name} (${interface.className})`,
                  value: interface.className,
                  short: `${interface.group.name} (${interface.className})`,
                  groupId: interface.groupId
                })
              }
            })
            done(null, interfaceGroup)
          } else {
            done(res.body.message)
          }
        })
    },

    getIconGroup (done, answer, cookies) {
      request
        .get(neiUrls.interfaceApi + apiGroupDetail.id)
        .set(cookies.base_headers)
        .set('Cookie', generateCookie(cookies.cookies))
        .end((err, res) => {
          if (res.body.code === 200) {
            const interfaceGroup = []
            res.body.result.forEach(interface => {
              const hasGroup = interfaceGroup.some(item => item.groupId === interface.groupId)
              if (!hasGroup) {
                interfaceGroup.push({
                  name: `${interface.group.name} (${interface.className})`,
                  value: interface.className,
                  short: `${interface.group.name} (${interface.className})`,
                  groupId: interface.groupId
                })
              }
            })
            done(null, interfaceGroup)
          } else {
            done(res.body.message)
          }
        })
    }

}
