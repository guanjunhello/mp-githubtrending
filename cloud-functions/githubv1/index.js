// 云函数入口文件
const cloud = require('wx-server-sdk')
cloud.init()
const octokit = require('@octokit/rest')()
const db = cloud.database()
const _ = db.command
db.collection("admin").where({website: "github", type: "token"}).get().then(res => {
  octokit.authenticate({
    type: 'oauth',
    token: res[0].value
  })
})
const per_page = 30;
const page = 1;

function dateFtt(fmt, date) { //author: meizz   
  var o = {
    "M+": date.getMonth() + 1,                 //月份   
    "d+": date.getDate(),                    //日   
    "h+": date.getHours(),                   //小时   
    "H+": date.getHours(),                   //小时   
    "m+": date.getMinutes(),                 //分   
    "s+": date.getSeconds(),                 //秒   
    "q+": Math.floor((date.getMonth() + 3) / 3), //季度   
    "S": date.getMilliseconds()             //毫秒   
  };
  if (/(y+)/.test(fmt))
    fmt = fmt.replace(RegExp.$1, (date.getFullYear() + "").substr(4 - RegExp.$1.length));
  for (var k in o)
    if (new RegExp("(" + k + ")").test(fmt))
      fmt = fmt.replace(RegExp.$1, (RegExp.$1.length == 1) ? (o[k]) : (("00" + o[k]).substr(("" + o[k]).length)));
  return fmt;
} 

function trace(OPENID, owner, repo, type) {
  db.collection('history').add({
    data: {
      openid: OPENID,
      owner,
      repo,
      type,
      requesttime: dateFtt("yyyy-MM-dd HH:mm:ss.S", new Date()),
    }
  }).then(res => { console.log(res) }).catch(console.error)
}

async function getHistory(openid) {
  var historys = await db.collection('history').where({openid, type:'readme'}).get()
  var col = db.collection('github')
  var filter = []
  historys.data.map(function(h) {
    filter.push({
      repo: h.owner + ' / ' + h.repo,
    })
  })
  if (filter.length == 0) {
    return []
    
  }
  var result = await col.where(_.or(filter)).get()
  return result.data 
}

// 云函数入口函数
exports.main = async (event, context) => {
  var {owner, repo, type} = event;
  const { OPENID, APPID } = cloud.getWXContext()
  trace(OPENID, owner, repo, type)
  var ref = 'master';
  var res;
  if (!type || type == "readme") {
    res = await octokit.repos.getReadme({ owner, repo, ref })
    return {
      content: res['data']['content'],
      name: res['data']['name'],
    }
  } else if (type == "releases") {
    res = await octokit.repos.listReleases({ owner, repo, per_page, page })
    return { content: res['data']}
  } else if (type == "commits") {
    res = await octokit.repos.listCommits({ owner, repo, per_page })
    return {content: res['data']}
  } else if (type == "issues") {
    res = await octokit.issues.listForRepo({ owner, repo, sort: "updated", per_page, page })   
    return {content: res['data']}
  } else if (type == 'history') {
    return {content: await getHistory()}
  }
  
  return {
    error: "Not Support Type",
    type: type
  }
}