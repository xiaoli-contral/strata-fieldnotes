import crypto from 'node:crypto';

const TRUSTED='6A5AA1D4EAFF4E9FB37E23D68491D6F4';
const CHROMIUM='143.0.3650.75';

function secMsGec(){
  const ticks=Math.floor(Date.now()/1000)+11644473600;
  const rounded=ticks-(ticks%300);
  return crypto.createHash('sha256').update(`${BigInt(rounded)*10000000n}${TRUSTED}`).digest('hex').toUpperCase();
}

function stamp(){
  const date=new Date(),days=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const pad=value=>String(value).padStart(2,'0');
  return `${days[date.getUTCDay()]} ${months[date.getUTCMonth()]} ${pad(date.getUTCDate())} ${date.getUTCFullYear()} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())} GMT+0000 (Coordinated Universal Time)`;
}

function escapeSSML(text){return text.replace(/[&<>]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[char]));}

export async function synthesizeSpeech(text,{name='zh-CN-XiaoxiaoNeural',style='gentle',rate='-12%',pitch='-2st',xmlLang='zh-CN'}={}){
  const spoken=escapeSSML(String(text||'').trim());
  if(!spoken)throw new Error('没有可朗读的句子');
  const connection=crypto.randomUUID().replaceAll('-','');
  const url=`wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=${TRUSTED}&ConnectionId=${connection}&Sec-MS-GEC=${secMsGec()}&Sec-MS-GEC-Version=1-${CHROMIUM}`;
  const socket=new WebSocket(url,{headers:{
    'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0',
    Origin:'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold'
  }});
  const time=stamp();
  const chunks=[];
  const audio=await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{socket.close();reject(new Error('人声合成超时'));},20000);
    socket.addEventListener('error',()=>{clearTimeout(timer);reject(new Error('人声合成没有连上'));});
    socket.addEventListener('open',()=>{
      socket.send(`X-Timestamp:${time}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":false,"wordBoundaryEnabled":false},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}`);
      const inner=style?`<mstts:express-as style="${style}"><prosody rate="${rate}" pitch="${pitch}">${spoken}</prosody></mstts:express-as>`:`<prosody rate="${rate}" pitch="${pitch}">${spoken}</prosody>`;
      const ssml=`<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="${xmlLang}"><voice name="${name}">${inner}</voice></speak>`;
      socket.send(`X-RequestId:${crypto.randomUUID()}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${time}\r\nPath:ssml\r\n\r\n${ssml}`);
    });
    socket.addEventListener('message',async event=>{
      try{
        const data=event.data;
        if(typeof data==='string'){
          if(data.includes('Path:turn.end')){clearTimeout(timer);socket.close();const joined=Buffer.concat(chunks);if(joined.length<1000)reject(new Error('人声合成结果过短'));else resolve(joined);}
          return;
        }
        const bytes=Buffer.from(await data.arrayBuffer());
        const marker=Buffer.from('Path:audio\r\n');
        const at=bytes.indexOf(marker);
        chunks.push(at>=0?bytes.subarray(at+marker.length):bytes);
      }catch(error){clearTimeout(timer);socket.close();reject(error);}
    });
  });
  if(audio.length<1000)throw new Error('人声合成结果过短');
  return audio;
}
