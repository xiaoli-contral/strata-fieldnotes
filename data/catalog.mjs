// 本机资料卡。识别出的字在这里对遗址。anchor 是城区参考点，不是遗址坐标。腰岭子只留线索，不生成场景。
export const sources = [
 {id:'photo-left',title:'吉林省博物院 · 左家山遗址展牌',publisher:'用户提供的现场照片',url:'/samples/left',kind:'现场展签',checked:'2026-10-01',summary:'展牌：农安县城东北约4公里，伊通河二级台地；距今7000—4800年；手制陶器、房址、石龙。展签年代未说明校正口径。'},
 {id:'gazetteer-left',title:'远古时期吉林 · 左家山遗址',publisher:'吉林省地方志编纂委员会',url:'https://dfz.jl.gov.cn/zsjl/201906/t20190630_5963378.html',kind:'地方志',checked:'2026-10-01',summary:'记载方形房址及柱洞、陶石骨器、蚌壳与鱼骨，以及分期碳十四测年。与展牌的年代口径分别保留。'},
 {id:'heritage',title:'吉林省第八批省级文物保护单位名录',publisher:'吉林省人民政府',url:'https://xxgk.jl.gov.cn/szf/gkml/202402/t20240206_8870808.html',kind:'政府名录',checked:'2026-10-01',summary:'提供部分遗址的时代、行政地址、保护范围。保护范围与考古文化分布范围是不同概念。'},
 {id:'yaolingzi',title:'在这座小城，藏着吉林最古老的村落遗址',publisher:'中国吉林网',url:'https://culture.cnjiwang.com/gxt/202503/3927748.html',kind:'报道线索',checked:'2026-10-01',summary:'九台腰岭子遗址的聚落与发掘介绍。仅作后续查找正式发掘报告的线索，不用于裁定农业比例或完整屋顶形制。'}
];
export const sites = [
 {id:'left',name:'左家山遗址',en:'ZUOJIASHAN',region:'吉林 · 长春 · 农安',period:'新石器时代',date:'距今约 7,000—4,800 年',dateNote:'展签原始表述；未标明是否为校正年代，暂不换算公元纪年。',photo:'/samples/left',keywords:['左家山','农安','筒形罐','石龙','伊通河'],anchor:{lat:44.43,lon:125.18,radiusKm:15,label:'农安县城区域参考点，非遗址坐标'},sources:['photo-left','gazetteer-left'],claims:[
 {id:'l1',level:'A',title:'河流台地上的居住痕迹',text:'展牌与地方志记载遗址位于伊通河台地；发掘发现房址、灰坑与陶石骨器。',sources:['photo-left','gazetteer-left']},
 {id:'l2',level:'A',title:'手制陶器与水域遗存',text:'资料记载筒形罐等手制陶器、蚌壳和鱼骨；这些发现不能直接量化捕鱼在饮食中的比例。',sources:['photo-left','gazetteer-left']},
 {id:'l3',level:'B',title:'多种资源共同支撑生活',text:'鱼骨、蚌壳与兽骨等材料支持利用多类资源的解释；不能据此断定已经以农业为主。',sources:['gazetteer-left']},
 {id:'l4',level:'U',title:'屋顶、季节和具体衣着',text:'现有资料不足以确定屋顶结构、某一天的植被与居民衣着。未来视觉补全须单独标注。',sources:[]}
 ]},
 {id:'yaolingzi',name:'九台腰岭子遗址',en:'YAOLINGZI',region:'吉林 · 长春 · 九台',period:'新石器时代',date:'报道约距今 6,500 年',dateNote:'报道年代，校正口径和具体文化层待核验；不能与其他同名遗址合并。',photo:null,keywords:['腰岭子','九台'],anchor:{lat:44.15,lon:125.84,radiusKm:45,label:'九台城区区域参考点，非遗址坐标'},sources:['yaolingzi'],claims:[{id:'y1',level:'B',title:'聚落线索待发掘报告核验',text:'公开报道介绍房址和器物发现。首版保留为区域检索线索，不生成具体生活场景。',sources:['yaolingzi']},{id:'y2',level:'U',title:'同名地点需要区分',text:'旧版整理中存在长岭与九台腰岭子混用风险；本卡仅对应九台，暂不继承旧 PDF 的农业判断。',sources:[]}]}
];
export function candidates(text=''){let q=text.replace(/\s/g,'').toLowerCase();return sites.map(s=>({...s,score:s.keywords.filter(k=>q.includes(k.toLowerCase())).length})).filter(s=>s.score>0).sort((a,b)=>b.score-a.score).map(s=>({id:s.id,name:s.name,reason:'文本命中：'+s.keywords.filter(k=>q.includes(k.toLowerCase())).join('、')}));}
export function distanceKm(a,b){let rad=x=>x*Math.PI/180;let dlat=rad(b.lat-a.lat),dlon=rad(b.lon-a.lon);let h=Math.sin(dlat/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dlon/2)**2;return 6371*2*Math.atan2(Math.sqrt(h),Math.sqrt(1-h));}
export function nearby(lat,lon,accuracy=0){if(!Number.isFinite(lat)||!Number.isFinite(lon)||lat < -90||lat>90||lon < -180||lon>180||!Number.isFinite(accuracy)||accuracy<0)throw new Error('坐标无效');return sites.map(s=>{let d=distanceKm({lat,lon},s.anchor),u=s.anchor.radiusKm+accuracy/1000;return {id:s.id,name:s.name,minKm:Math.floor(Math.max(0,d-u)),maxKm:Math.ceil(d+u),precision:s.anchor.label,scope:'区域参考距离，不代表遗址边界或导航距离'};}).sort((a,b)=>a.minKm-b.minKm);}
