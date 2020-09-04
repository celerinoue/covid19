import fs from 'fs'
import fetch from 'node-fetch'
import cheerio from 'cheerio'
import util from './util.mjs'
import pdf2text from './pdf2text.mjs'
//import pdf2text from './pdf2text.js'

const PREF = util.JAPAN_PREF
const PREF_EN = util.JAPAN_PREF_EN

const parseURLCovid19Latest = async function (urlweb) {
  const html = await (await fetch(urlweb)).text();
  // console.log(html)
  const title = "新型コロナウイルス感染症患者の療養状況等及び入院患者受入病床数等に関する調査結果";
  const baseurl = urlweb.substring(0, urlweb.indexOf("/", 8));
  return parseLink(html, title, baseurl);
}

const parseWeek = function(s) {
  s = util.toHalf(s)
  const n = s.indexOf('週')
  return s.substring(0, n)
}
// '国内事例における都道府県別の患者報告数（2020年3月13日12時時点）' -> 2020/03/09 09:00
const parseDate = function(s) {
  const fix0 = util.fix0
  s = s.substring(s.lastIndexOf('（'))
  s = util.toHalf(s);
  console.log(s);
  let num = s.match(/(\d+)月(\d+)日(\d+)時時点\)/)
  if (num) {
    const now = new Date();
    const y = now.getFullYear();
    const m = parseInt(num[1]);
    if (now.getMonth() === 0 && m === 12) {
      y--;
    }
    const d = parseInt(num[2])
    const h = parseInt(num[3])
    return y + "-" + fix0(m, 2) + "-" + fix0(d, 2) + "T" + fix0(h, 2) + ":00"
  }
  return "--"
//  console.log(s, num)
}

const parseLink = function(data, title, baseurl) {
  const dom = cheerio.load(data)
  let res = null
  dom('a').each((idx, ele) => {
    const text = dom(ele).text()
    if (res == null && text && text.indexOf(title) >= 0) {
      res = {}
      res.dt = parseDate(text)
      const href = dom(ele).attr("href")
      res.url = href.startsWith("https://") ? href : baseurl + href
    }
  })
  return res
}

const text2csv = function (txt, lastUpdate, url) {
  const ss = txt.split('\n')
  console.log(ss)
  const list = []
  // list.push(['都道府県番号', '都道府県名', 'PCR検査陽性者数', '入院者数', '入院患者受入確保病床', '入院患者受入確保想定病床数', 'うち重症者数', '重症患者受入確保病床数', '重症患者受入確保想定病床数', '宿泊療養者数', '宿泊施設受入可能室数', '自宅療養者数', '社会福祉施設等療養者数', '確認中の人数', '更新日', '出典']);
  list.push(['都道府県番号', '都道府県名', 'PCR検査陽性者数', '入院者数', '入院患者フェーズ', '入院患者受入確保病床', '入院患者病床使用率', '入院患者即応病床数（最終フェーズ）'/*旧 入院患者受入確保想定病床数*/, 'うち重症者数', '重症者フェーズ', '重症患者受入確保病床数', '重症患者病床使用率', '重症患者即応病床数（最終フェーズ）'/*旧 重症患者受入確保想定病床数*/, '宿泊療養者数', '宿泊療養フェーズ', '宿泊施設受入可能室数', '宿泊療養施設居室使用率', '宿泊療養施設施設居室（最終フェーズ）', '自宅療養者数', '社会福祉施設等療養者数', '確認中の人数', '更新日', '出典']);
  for (let i = 0; i < PREF.length; i++) {
    const pref = PREF[i];
    console.log(pref);
    for (let j = 0; j < ss.length; j++) {
      const ss2 = ss[j].replace(/,/g, '').split(' ').filter(s => util.toHalf(s).replace(/\s/g, ''));
      if (ss2[1] == pref) {
        console.log(pref, ss2);
        ss2.push(lastUpdate);
        ss2.push(url);
        list.push(ss2);
        break;
      }
    }
  }
  // console.log(list)
  return list;
}

const makeCovid19JapanBeds = async function () {
  const urltop = "https://www.mhlw.go.jp/stf/seisakunitsuite/newpage_00023.html";
  //const url = "https://www.mhlw.go.jp/content/10900000/000655343.pdf"; //await parseURLCovid19Latest(urltop)
  const latest = await parseURLCovid19Latest(urltop)
  console.log(latest)
  const url = latest.url;
  const cutT = (s) => {
    if (s.endsWith("T00:00")) {
      const s2 = s.substring(0, s.length - 6);
      return s2;
    }
    return s;
  };
  const lastUpdate = cutT(latest.dt);
  //process.exit(0);

  const path = '../data/covid19japan_beds/'
  let fn = null // '000630627.pdf'

  const fetchdata = true;
  // fn = "000655343.pdf";
  // const lastUpdate = "2020-07-29";
  //const fetchdata = true
  if (fetchdata) {
    fn = url.substring(url.lastIndexOf('/') + 1)
    const pdf = await (await fetch(url)).arrayBuffer()
    fs.writeFileSync(path + fn, new Buffer.from(pdf), 'binary')
  }

  const txt = await pdf2text.pdf2text(path + fn)
  console.log(txt)

  const csv = text2csv(txt, lastUpdate, url);
  console.log(csv);

 
  fs.writeFileSync(path + fn + '.csv', util.addBOM(util.encodeCSV(csv)), 'utf-8')
  //process.exit(0);


  const json = util.csv2json(csv);
  const scsv = util.addBOM(util.encodeCSV(csv));
  console.log(path + lastUpdate + '.csv')
  fs.writeFileSync(path + lastUpdate + '.csv', scsv, 'utf-8')
  fs.writeFileSync(path + lastUpdate + '.json', JSON.stringify(json), 'utf-8')

  fs.writeFileSync(path + 'latest.csv', scsv, 'utf-8')
  fs.writeFileSync(path + 'latest.json', JSON.stringify(json), 'utf-8')
}

const main = async () => {
  //await mainV2()
  makeCovid19JapanBeds();
}
if (process.argv[1].endsWith('/covid19beds.mjs')) {
  main()
}

// exports.getCovid19DataJSON = getCovid19DataJSON
// exports.getCovid19DataSummaryForIchigoJam = getCovid19DataSummaryForIchigoJam
