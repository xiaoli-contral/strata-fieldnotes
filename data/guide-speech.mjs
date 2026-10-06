// 左家山一期后段的口头预设。换地点时改 guidePreset 和 guideLines，回答不能超出这份预设。
// 第一人称是教学对白，不是古人原话。追问才调用 DeepSeek。
// Spoken lines for the phase-I guide. Facts stay inside the gazetteer preset.
// The first-person feeling is a teaching simulation, not an ancient testimony.
export const guideVoice={
  id:'xiaoxiao-gentle',
  name:'zh-CN-XiaoxiaoNeural',
  label:'晓晓轻声',
  style:'',
  rate:'-12%',
  pitch:'-2st'
};

export const guideLines=[
  {id:'opening',ask:'',text:'你走近了。我在这方屋子里，针还捏在手里。八个柱洞围着我，外面是河滩。头顶原来什么样，我说不清。'},
  {id:'house',ask:'这房子怎么住',text:'地是方的。八个洞里立着柱。人就在这方块里睡觉、做活。顶上盖的什么，没人说准。'},
  {id:'pot',ask:'罐子做什么用',text:'手捏的灰褐罐子。身上有弦纹和席纹，也压着之字纹。装过水还是粮食，罐子不告诉我。'},
  {id:'winter',ask:'冬天怎么过',text:'冷了就往柱边挤。针还要穿，锥子还要钻。那一个冬天有多冷，没有人记。'}
];

export const guidePreset=`吉林农安，伊通河台地上的左家山。一期后段有一座方形房址，八个柱洞。房里有沙质灰褐陶、骨针、骨锥。骨针只说明有穿缝，不能指定皮、麻或树皮。一期有手制筒形罐，能见到刻划弦纹、席纹和压印之字纹。碳十四有一项距今6755加减115年，只是这一层的线索。鱼骨、蚌壳、兽骨见于整个遗址。屋顶、衣料、姓名、性别、某一天的冷暖，资料里没有。不要提石龙，也不要说当时已经以种地为主。不要编夯土、火候、地界和具体人名。`;

const banned=/不是.{0,16}而是|并非.{0,16}而是|不在于|与其说|说白了|说穿了|说到底|夯土|火候|地界|石龙|农业为主|兽皮|皮衣|皮子|麻布|树皮|煮鱼|鱼汤/;

export function cleanSpoken(text){
  let value=String(text||'').replace(/[#>*_`]/g,'').replace(/\s+/g,' ').replace(/[—–-]/g,'').replace(/[:：]/g,'，').trim();
  value=value.replace(/^[，。]+|[，。]+$/g,'');
  if(!value||banned.test(value))return '';
  if(/罐/.test(value)&&/鱼|蚌|兽骨|壳/.test(value))return '';
  if(value.length>80)value=value.slice(0,80).replace(/[^。！？]*$/,'');
  return /[。！？]$/.test(value)?value:`${value}。`;
}

export function guideLine(id){return guideLines.find(line=>line.id===id)||null;}

export async function replyToVisitor(question){
  const ask=String(question||'').replace(/\s+/g,' ').trim().slice(0,40);
  if(ask.length<2){const error=new Error('先写一句想问的话');error.status=400;throw error;}
  const known=guideLines.find(line=>line.ask&&(ask===line.ask||ask.includes(line.ask)));
  if(known)return {id:known.id,text:known.text,cached:true};
  const key=process.env.DEEPSEEK_API_KEY;
  if(!key){const error=new Error('DeepSeek 密钥还没配好');error.status=503;throw error;}
  async function askModel(extra=''){
    const response=await fetch('https://api.deepseek.com/chat/completions',{
      method:'POST',
      headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},
      body:JSON.stringify({
        model:'deepseek-chat',
        temperature:.4,
        max_tokens:120,
        messages:[
          {role:'system',content:`你是教学想象里住在左家山一期后段方屋中的人。对方正站在这间方屋前，看得见河滩、八个柱洞、手捏的灰褐罐子和你手里的骨针。用第一人称直接回答他刚才那句问话，答案要落到这些眼前的东西上。不知道的名字、衣料、屋顶和某一天的冷暖，就说没有留下。问罐子装什么，只说到灰褐、弦纹、席纹、之字纹，再说装过水还是粮食，罐子不告诉我。鱼骨和蚌壳是整个遗址有的，不能放进这只罐子，也不能说拿来煮。一句到两句，不超过四十字。口语。不要写冒号和破折号，也不要先否定再翻过来讲。${extra}\n预设。${guidePreset}\n问你是谁，可以这样答。我就住这方屋子，针还捏在手里。名字没有留下。`},
          {role:'user',content:ask}
        ]
      }),
      signal:AbortSignal.timeout(20000)
    });
    const data=await response.json().catch(()=>({}));
    if(!response.ok){const error=new Error('她这会儿没有接上话');error.status=502;throw error;}
    return cleanSpoken(data.choices?.[0]?.message?.content);
  }
  const text=await askModel()||await askModel('上一句把鱼、蚌或兽骨说进了罐子，或写成了煮食。罐子装什么没有写明。只说眼前的方屋、柱洞、骨针、罐子纹样，或直接说不知道。')||'这件事留下来的话不够，我说不准。';
  return {text,cached:false};
}
