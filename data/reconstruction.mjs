// 左家山一期后段的生成约束。当前世界用的是没有房屋的河岸图，人和物件是后来叠上去的。
export const reconstruction = {
  siteId: 'left',
  phase: '左家山一期后段',
  phaseDate: '一期后段碳十四测定距今 6,755±115 年；资料未说明是否校正，此处不换算公元纪年。',
  evidence: [
    {label:'伊通河二级台地',source:'gazetteer-left',level:'A'},
    {label:'方形房址与八个柱洞',source:'gazetteer-left',level:'A'},
    {label:'手制沙质灰褐陶筒形罐',source:'gazetteer-left',level:'A'},
    {label:'一期后段碳十四 6,755±115 年',source:'gazetteer-left',level:'A'}
  ],
  visualUnknowns:['屋顶材料与坡度','当时的具体植被组合','居民衣着与面貌','器物原始颜色及完整比例','烧土遗迹是否与一期房址同层'],
  world: {
    model:'marble-1.1',
    estimatedCredits:1580,
    prompt:'An archaeological interpretive reconstruction of a small Neolithic settlement on the second terrace above the Yitong River in present-day Nong’an, Jilin, northeast China. Ground-level view from the terrace toward a nearby gently flowing river. One modest square post-framed dwelling indicated by eight timber posts and a simple earthen floor, small areas of fired earth, a few plain handmade sandy gray-brown cylindrical clay jars and stone tools near the dwelling. Natural riverbank and open terrace, restrained vegetation suitable for northeastern China. Human scale but no people. Educational museum reconstruction, daylight, physically plausible, no monuments, no palaces, no bronze, no metal, no modern structures, no writing, no fantasy. Roof form, vegetation and colors are interpretive visual completion rather than proven facts.'
  },
  imageWorld: {
    model:'marble-1.1',
    estimatedCredits:1580,
    conceptImage:'/generated/left-phase1-concept-v2.png',
    prompt:'Use the supplied single image as the visual anchor for a coherent, walkable late Phase I Zuojiashan riverside terrace scene. Preserve its modest handmade dwelling, Yitong River terrace, gray-brown cylindrical handmade pottery and quiet ground-level composition. Extend the scene naturally beyond the frame without adding extra settlements, monuments, metal, modern features, writing or fantasy. This is an archaeological interpretive reconstruction: roof, clothing and exact vegetation are hypothetical.'
  },
  plusWorld: {
    model:'marble-1.1-plus',
    estimatedCreditsMin:1580,
    estimatedCreditsMax:3080,
    comparisonBaseline:'imageWorld',
    conceptImage:'/generated/left-phase1-concept-v2.png'
  },
  object: {
    id:'cylindrical-pot',
    name:'手制筒形陶罐',
    phase:'左家山一期',
    level:'A 型制有据；完整外形为推测',
    description:'地方志记载，左家山一期出土过手制的沙质灰褐陶筒形罐，可见刻划弦纹、席纹和压印“之”字纹。一期后段有一项碳十四测年为距今 6,755±115 年；这是文化层的测年线索，不是给眼前这件模型或某个陶罐单独测得的年龄。制作和使用它的人属于当时在伊通河台地活动的居民，现有材料不能确定个人身份。陶罐可能用于盛放、处理日常物资，但某件器物的具体用途尚需残留物和使用痕迹等证据。它让我们看见当时已有手工制陶及较稳定的居住活动；不能仅凭器形推断仪式意义。这个 Tripo 模型是类型示意，不是出土原器扫描，摆放位置也不是出土原位。',
    sourceIds:['photo-left','gazetteer-left'],
    model:'v3.1-20260211',
    estimatedCredits:20,
    prompt:'A single Neolithic hand-built cylindrical pottery jar from an archaeological site in northeastern China. Straight cylindrical body, open round rim, flat base, sandy gray-brown fired clay with subtle uneven handmade surface, simple incised horizontal parallel lines and a restrained pressed zigzag band. Realistic museum artifact reconstruction, one isolated object, complete silhouette, no handles, no lid, no glaze, no painting, no metal, no stand, no text, no background scene. This is a typological interpretation, not an exact scan of an excavated vessel.'
  }
};
