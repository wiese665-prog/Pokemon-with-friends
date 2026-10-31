'use strict';
const $=id=>document.getElementById(id),app=$('app');
let data,world,g,booting=false,page='boot',modalOpen=false,boxIndex=0,trainerQuery='',dexQuery='',travelRegion='Alle',travelQuery='',selectedAvatar=69,moveBusy=false,mapData=null,mapImage=null,mapDepth=null,displayX=23,displayY=13,fromX=23,fromY=13,moveStart=0,lastStep=0,walking=false,direction=0,walkFoot=0,touchDir=-1,held=new Set(),packLoaded=false;
const images=new Map(),frames=new Map();let toastTimer,loopId=0;
function el(tag,props={},...children){const n=document.createElement(tag);for(const [k,v]of Object.entries(props)){if(k.startsWith('on'))n.addEventListener(k.slice(2),v);else if(k==='class')n.className=v;else if(k==='text')n.textContent=v;else if(k==='style')n.style.cssText=v;else if(v!==undefined&&v!==null)n.setAttribute(k,String(v));}for(const child of children.flat(Infinity)){if(child===null||child===undefined)continue;n.append(child instanceof Node?child:document.createTextNode(String(child)));}return n;}
function btn(text,fn,cls='',disabled=false){const b=el('button',{class:cls,onclick:()=>run(fn)},text);b.disabled=disabled;return b;}
function run(fn){try{const r=fn();if(r&&r.catch)r.catch(error=>toast(error.message));return r;}catch(error){toast(error.message);}}
function toast(text){$('toast').textContent=text;$('toast').style.display='block';clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').style.display='none',4500);}
function clearInput(){held.clear();touchDir=-1;}
function closeModal(){modalOpen=false;$('modal-root').replaceChildren();clearInput();}
function modal(title,body,buttons=[]){modalOpen=true;clearInput();$('modal-root').replaceChildren(el('div',{class:'modal-shade'},el('section',{class:'modal'},el('header',{},el('h2',{},title),btn('×',closeModal,'quiet')),el('div',{class:'body'},body),buttons.length?el('div',{class:'buttons'},buttons):null)));}
function confirmBox(title,text,action){modal(title,el('p',{},text),[btn('Abbrechen',closeModal,'quiet'),btn('Bestätigen',()=>{closeModal();return action();},'primary')]);}
function path(name){return '/pack/'+name;}
async function json(name){const r=await fetch(path(name));if(!r.ok)throw Error('Daten fehlen: '+name);return r.json();}
function image(name){if(images.has(name))return images.get(name);const p=new Promise((resolve,reject)=>{let im=new Image();im.onload=()=>resolve(im);im.onerror=()=>{images.delete(name);reject(Error('Grafik fehlt: '+name));};im.src=path(name);});images.set(name,p);return p;}
function art(sid,side='front',cls='art'){return el('img',{class:cls,src:path('pokemon/'+sid+'_'+side+'.png'),alt:data.species[sid].name,loading:'lazy'});}
function avatarArt(id,cls='avatar'){return el('div',{class:cls,style:'background-image:url("'+path('trainers/'+id+'.png')+'")','aria-label':'Trainerfigur'});}
function header(){return world.headers[mapData?.header||60];}
function money(){return g.s.money.toLocaleString('de-DE')+' ₽';}
function hpbar(m){const ratio=m.hp/g.stats(m)[0];return el('div',{class:'hp '+(ratio<.2?'critical':ratio<.5?'low':'')},el('span',{style:'width:'+Math.round(ratio*100)+'%'}));}
function typeTags(m){return el('div',{class:'tags'},[...new Set(g.species(m).types)].map(t=>el('span',{class:'tag'},PWF.TYPES[t])));}
function titleHead(title,desc,actions=[]){return el('div',{class:'page-head'},el('div',{},el('div',{class:'eyebrow'},'POKÉMON WITH FRIENDS'),el('h1',{},title),el('p',{},desc)),el('div',{class:'actions'},actions));}
function showPage(name,content){page=name;clearInput();app.replaceChildren(el('div',{class:'page'},content));}
function backButton(){return btn('Zurück',()=>showWorld(),'quiet');}
async function boot(){
 if(booting||packLoaded)return;
 if(window.Android&&!Android.ready()){$('boot-text').textContent=Android.error()||'Das private Weltpaket wird vorbereitet. Falls keines eingebaut ist, kannst du es hier importieren.';return;}
 booting=true;
 try{
  [data,world]=await Promise.all([json('data.json'),json('world.json')]);
  if(world.version!==3||data.species.length!==494)throw Error('Dieses Weltpaket ist nicht kompatibel.');
  let saved=window.Android?Android.load():localStorage.getItem('pwf-v3');
  try{g=new PWF.Game(data,saved?JSON.parse(saved):null);}catch(error){modal('Spielstand konnte nicht geladen werden',el('p',{},error.message+'. Dein vorhandener Stand wird nicht überschrieben.'),[btn('Sicherung importieren',()=>window.Android?Android.importSave():toast('Dateiimport ist in der Android-App verfügbar.'))]);booting=false;return;}
  g.onSave=text=>{try{const ok=window.Android?Android.save(text):(localStorage.setItem('pwf-v3',text),true);if(!ok)toast('Speichern fehlgeschlagen. Bitte eine Sicherung exportieren.');}catch(error){toast('Spielstand konnte nicht gespeichert werden: '+error.message);}};
  selectedAvatar=data.avatars.some(a=>a.id===g.s.avatar)?g.s.avatar:69;packLoaded=true;
  const h=world.headers[world.cells[g.s.map]?.header];if(!h){g.s.map=world.start.map;g.s.x=world.start.x;g.s.y=world.start.y;}
  await loadMap(g.s.map,g.s.x,g.s.y,false);showTrainers();
 }catch(error){$('boot-text').textContent=error.message;booting=false;}
}
window.packReady=()=>run(boot);$('import-pack').onclick=()=>window.Android?Android.importPack():toast('Bitte in der Android-App importieren.');run(boot);
window.receiveSave=text=>{run(()=>{const next=new PWF.Game(data,JSON.parse(text));if(!world.cells[next.s.map])throw Error('Karte im Spielstand ist nicht verfügbar.');confirmBox('Spielstand laden?','Der aktuelle Stand wird durch diese Sicherung ersetzt.',async()=>{g.s=next.s;g.battle=null;g.save();await loadMap(g.s.map,g.s.x,g.s.y);showWorld();toast('Spielstand geladen.');});});};
window.pwfPause=()=>{clearInput();if(g)g.save();};
window.pwfBack=()=>{if(modalOpen){closeModal();return;}if(g?.battle){if(g.battle.result)finishBattle();else toast('Beende den Kampf oder nutze Flucht.');return;}if(page==='world')showMenu();else if(g?.s.party.length)showWorld();else showTrainers();};

function showTrainers(){
 const grid=el('div',{class:'grid'}),input=el('input',{placeholder:'Trainer suchen …',value:trainerQuery}),name=el('input',{value:g.s.name,maxlength:10,'aria-label':'Trainername'}),aside=el('aside',{class:'aside'});
 const updateAside=()=>{const avatar=data.avatars.find(a=>a.id===selectedAvatar);aside.replaceChildren(el('div',{class:'eyebrow'},'DEIN TRAINER'),avatarArt(selectedAvatar,'hero'),el('h2',{},avatar.name),el('small',{},'Dein Name'),name,btn(g.s.party.length?'Abenteuer fortsetzen  ›':'Starter wählen  ›',async()=>{g.s.name=name.value.trim()||'GOLD';g.s.avatar=selectedAvatar;g.save();if(!g.s.party.length)showStarter();else{await loadMap(g.s.map,g.s.x,g.s.y);showWorld();}},'primary'),el('small',{},'Johto & Kanto sind ohne Story-Sperren zugänglich. Dein Fortschritt wird automatisch gespeichert.'));};
 const render=()=>{grid.replaceChildren(...data.avatars.filter(a=>a.name.toLowerCase().includes(trainerQuery.toLowerCase())).map(a=>{const card=el('div',{class:'card'+(selectedAvatar===a.id?' selected':'')},avatarArt(a.id),el('h3',{},a.name),btn('Auswählen',()=>{selectedAvatar=a.id;render();updateAside();},'quiet'));return card;}));};
 input.oninput=()=>{trainerQuery=input.value;render();};updateAside();render();
 showPage('trainers',[titleHead('Dein Abenteuer. Deine Figur.',data.avatars.length+' spielbare Trainer · Johto und Kanto · offline',[btn('Spielstand',showSave,'quiet')]),el('div',{class:'split'},el('div',{class:'scroll'},el('div',{class:'filters'},input),el('div',{style:'height:12px'}),grid),aside),el('div',{class:'footer'},el('span',{},'FREIE ERKUNDUNG · v0.3'),el('span',{class:'save-dot'},'● Automatisches Speichern'))]);
}
function showStarter(){
 const panel=el('div',{class:'grid'}),input=el('input',{placeholder:'Starter frei wählen: Name oder Nummer …'});
 const render=()=>{let q=input.value.toLowerCase();let list=q?data.species.filter(Boolean).filter(s=>s.name.toLowerCase().includes(q)||String(s.id)===q):[152,155,158,1,4,7,25,133].map(id=>data.species[id]);panel.replaceChildren(...list.map(s=>el('article',{class:'card'},art(s.id),el('h3',{},s.name),el('small',{},'#'+s.id+' · Level 5'),btn('Als Partner wählen',()=>{g.starter(s.id);showWorld();},'primary'))));};input.oninput=render;render();showPage('starter',[titleHead('Mit wem beginnt deine Reise?','Im freien Modus kannst du jede der 493 Arten als Starter wählen.',[btn('Trainer',showTrainers,'quiet')]),input,el('div',{class:'scroll'},panel)]);
}
function currentJob(){return world.jobs[mapData.asset];}
function walkable(cell,x,y){const j=world.jobs[cell.asset];return !j.error&&x>=0&&x<32&&y>=0&&y<32&&j.collision[y][x]==='0';}
function nearest(cell,x=16,y=16){x=PWF.clamp(Math.floor(x),0,31);y=PWF.clamp(Math.floor(y),0,31);for(let r=0;r<32;r++)for(let yy=Math.max(0,y-r);yy<=Math.min(31,y+r);yy++)for(let xx=Math.max(0,x-r);xx<=Math.min(31,x+r);xx++)if(walkable(cell,xx,yy))return [xx,yy];return null;}
async function loadMap(key,x,y,persist=true){
 const cell=world.cells[key];if(!cell)throw Error('Hier endet der importierte Kartenbereich.');const job=world.jobs[cell.asset];if(job.error)throw Error('Dieser Kartenabschnitt konnte noch nicht dargestellt werden: '+job.error);
 let spawn=walkable(cell,x,y)?[x,y]:nearest(cell,x,y);if(!spawn)throw Error('Dieser Abschnitt hat keine begehbaren Felder.');moveBusy=true;
 try{
  const [im,response]=await Promise.all([image('maps/'+cell.asset+'.png'),fetch(path('maps/'+cell.asset+'.depth'))]);if(!response.ok)throw Error('Tiefenkarte fehlt.');const depth=new Uint16Array(await response.arrayBuffer());if(depth.length!==1152*1152)throw Error('Ungültige Tiefenkarte.');
  mapData=cell;mapImage=im;mapDepth=depth;g.s.map=key;[g.s.x,g.s.y]=spawn;displayX=fromX=g.s.x;displayY=fromY=g.s.y;walking=false;g.mark(g.s.visited,key);if(persist)g.save();
  await image('trainers/'+g.s.avatar+'.png');if(page==='world')showWorld();
  // Keep only the current map image and small character assets in memory.
  for(const name of images.keys())if(name.startsWith('maps/')&&name!=='maps/'+cell.asset+'.png')images.delete(name);
 }finally{moveBusy=false;}
}
function showWorld(){
 if(!g.s.party.length){showStarter();return;}page='world';clearInput();
 const canvas=el('canvas',{id:'world',width:960,height:540,'aria-label':'Erkundungskarte'}),h=header(),avatar=data.avatars.find(a=>a.id===g.s.avatar);
 const dpad=el('div',{class:'dpad'});
 for(const [cls,label,dir]of [['up','▲',1],['left','◀',2],['right','▶',3],['down','▼',0]]){
  const b=el('button',{class:cls,'aria-label':cls},label);b.onpointerdown=e=>{e.preventDefault();b.setPointerCapture(e.pointerId);touchDir=dir;};b.onpointerup=b.onpointercancel=()=>touchDir=-1;b.onlostpointercapture=()=>touchDir=-1;dpad.append(b);
 }
 app.replaceChildren(el('div',{class:'world'},canvas,el('div',{class:'hud'},el('div',{},el('h2',{},h.name),el('small',{},h.region+' · '+money()+' · '+g.s.badges.length+'/16 Orden')),el('div',{class:'tools'},btn('Team',showTeam),btn('Beutel',showBag),btn('Pokédex',showDex),btn('Karte',showTravel),btn('Menü',showMenu))),dpad,el('div',{class:'world-actions'},btn('Begegnung',()=>wildEncounter(true),'quiet'),btn('A',interact,'interact')),el('div',{class:'world-hint'},'WASD / Pfeile: laufen · E / Enter: interagieren · '+avatar.name)));
 const id=++loopId;requestAnimationFrame(t=>drawWorld(t,id));
}
function inputDirection(){if(touchDir>=0)return touchDir;for(const [key,dir]of [['w',1],['arrowup',1],['s',0],['arrowdown',0],['a',2],['arrowleft',2],['d',3],['arrowright',3]])if(held.has(key))return dir;return -1;}
async function tryMove(dir){
 if(moveBusy||modalOpen||g.battle||page!=='world')return;direction=dir;const dx=dir===2?-1:dir===3?1:0,dy=dir===1?-1:dir===0?1:0;let x=g.s.x+dx,y=g.s.y+dy;
 const gx=mapData.x*32+x,gy=mapData.y*32+y;let warp=header().warps.find(w=>w[0]===gx&&w[1]===gy);
 if(warp&&await useWarp(warp))return;
 if(x<0||y<0||x>31||y>31){const cx=mapData.x+(x<0?-1:x>31?1:0),cy=mapData.y+(y<0?-1:y>31?1:0),key=mapData.matrix+'_'+cx+'_'+cy;const cell=world.cells[key];let nx=(x+32)%32,ny=(y+32)%32;if(cell&&walkable(cell,nx,ny)){await loadMap(key,nx,ny);g.s.steps++;}return;}
 if(!walkable(mapData,x,y))return;
 fromX=displayX;fromY=displayY;g.s.x=x;g.s.y=y;moveStart=performance.now();walking=true;walkFoot=1-walkFoot;g.s.steps++;if(g.s.repel>0)g.s.repel--;if(g.s.steps%8===0)g.save();
 const attr=currentJob().attributes[y][x]&255,h=header();
 if(!g.s.repel&&(attr===2||attr===3||attr===21||h.mapType==='MAP_TYPE_CAVE')&&Math.random()<.1){lastStep=performance.now()+200;setTimeout(()=>{if(page==='world'&&!modalOpen)run(()=>wildEncounter(false));},160);}
}
async function useWarp(warp){
 const target=world.headers[warp[2]],anchor=target?.warps[warp[3]];if(!target||!anchor)return false;
 const key=target.matrixId+'_'+Math.floor(anchor[0]/32)+'_'+Math.floor(anchor[1]/32);const cell=world.cells[key];if(!cell)return false;
 await loadMap(key,anchor[0]%32,anchor[1]%32);direction=0;toast(target.name);return true;
}
async function frameData(avatar,frame,dir){const key=avatar+'_'+frame+'_'+dir;if(frames.has(key))return frames.get(key);const im=await image('trainers/'+avatar+'.png'),c=document.createElement('canvas');c.width=c.height=32;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(im,frame*32,dir*32,32,32,0,0,32,32);const p=ctx.getImageData(0,0,32,32).data;frames.set(key,p);return p;}
const maskCanvas=document.createElement('canvas');maskCanvas.width=maskCanvas.height=64;const maskCtx=maskCanvas.getContext('2d'),maskPixels=maskCtx.createImageData(64,64);let currentFrame=null,currentFrameKey='';
function drawCharacter(ctx,x,y,height,frame,avatar,dir){
 const wx=x*16-248,wz=y*16-248,fx=576+wx*2,fy=640+(.8*wz-.6*height)*2,q=.6*wz+.8*height,left=Math.round(fx-32),top=Math.round(fy-56);const key=avatar+'_'+frame+'_'+dir;
 const pixels=frames.get(key);if(!pixels){if(currentFrameKey!==key){currentFrameKey=key;frameData(avatar,frame,dir).catch(e=>toast(e.message));}return;}
 for(let yy=0;yy<64;yy++)for(let xx=0;xx<64;xx++){
  const source=((yy>>1)*32+(xx>>1))*4,o=(yy*64+xx)*4;maskPixels.data[o]=pixels[source];maskPixels.data[o+1]=pixels[source+1];maskPixels.data[o+2]=pixels[source+2];
  const mx=left+xx,my=top+yy,scene=mx>=0&&mx<1152&&my>=0&&my<1152?(mapDepth[my*1152+mx]-32768)/64:-500;maskPixels.data[o+3]=scene>q+1.5?0:pixels[source+3];
 }
 maskCtx.putImageData(maskPixels,0,0);ctx.drawImage(maskCanvas,left,top);
}
function drawWorld(now,id){
 if(id!==loopId)return;
 if(page!=='world')return;const c=$('world');if(!c||!mapImage)return;const ctx=c.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.fillStyle='#183829';ctx.fillRect(0,0,960,540);
 if(walking){let t=Math.min(1,(now-moveStart)/150);displayX=fromX+(g.s.x-fromX)*t;displayY=fromY+(g.s.y-fromY)*t;if(t>=1)walking=false;}
 const j=currentJob(),height=j.heights?.[g.s.y]?.[g.s.x]??16,wx=displayX*16-248,wz=displayY*16-248,fx=576+wx*2,fy=640+(.8*wz-.6*height)*2,ox=Math.max(-192,Math.min(0,480-fx)),oy=Math.max(-612,Math.min(0,280-fy));
 ctx.save();ctx.translate(ox,oy);ctx.drawImage(mapImage,0,0);
 // NPCs are interactive free-roam stand-ins; original event scripts are not executed.
 const npcs=header().npcs.filter(n=>Math.floor(n[12]/32)===mapData.x&&Math.floor(n[13]/32)===mapData.y);
 const actors=npcs.map(n=>({x:n[12]%32,y:n[13]%32,h:(n[14]/4096)||16,avatar:data.avatars.find(a=>a.id===n[1])?.id||3,dir:0,frame:0}));
 actors.push({x:displayX,y:displayY,h:height,avatar:g.s.avatar,dir:direction,frame:walking&&now-moveStart>40&&now-moveStart<115?(walkFoot?1:3):0});
 actors.sort((a,b)=>(.6*a.y*16+.8*a.h)-(.6*b.y*16+.8*b.h));for(const a of actors)drawCharacter(ctx,a.x,a.y,a.h,a.frame,a.avatar,a.dir);
 ctx.restore();
 const dir=inputDirection();if(!walking&&!moveBusy&&!modalOpen&&dir>=0&&now-lastStep>=155){lastStep=now;run(()=>tryMove(dir));}
 requestAnimationFrame(t=>drawWorld(t,id));
}
function wildEncounter(force){
 const h=header(),e=g.encounter(h.wildEncounterBank,(currentJob().attributes[g.s.y][g.s.x]&255)===21,new Date().getHours()<6||new Date().getHours()>19?'night':'day');
 if(!e){if(force){showDex(true);toast('Hier gibt es keine regulären wilden Pokémon. Im freien Modus kannst du eine Begegnung wählen.');}return;}
 g.startWild(e[0],e[1]);g.battle.dark=h.mapType==='MAP_TYPE_CAVE'||new Date().getHours()>=20||new Date().getHours()<4;showBattle();
}
function interact(){
 const dx=direction===2?-1:direction===3?1:0,dy=direction===1?-1:direction===0?1:0,gx=mapData.x*32+g.s.x+dx,gy=mapData.y*32+g.s.y+dy,h=header();const warp=h.warps.find(w=>w[0]===gx&&w[1]===gy);if(warp){run(()=>useWarp(warp));return;}
 const npc=h.npcs.find(n=>n[12]===gx&&n[13]===gy);
 if(npc){const candidate=[npc[7],npc[8],npc[9]].find(id=>data.trainers[id]?.party.length);modal('Begegnung',el('p',{},'Du kannst hier einen freien Trainerkampf beginnen oder die örtlichen Dienste nutzen.'),[candidate?btn('Trainerkampf',()=>{closeModal();g.startTrainer(candidate);showBattle();},'primary'):null,btn('Dienste',()=>{closeModal();showServices();})].filter(Boolean));return;}
 showServices();
}
function showMenu(){
 const body=el('div',{class:'grid'},[['Team',showTeam],['PC & Boxen',showBoxes],['Beutel',showBag],['Pokédex',showDex],['Johto & Kanto',showTravel],['Arenen & Orden',showGyms],['Trainer wählen',showTrainers],['Pokécenter & Markt',showServices],['Spielstand',showSave]].map(([label,fn])=>btn(label,()=>{closeModal();fn();})));modal('Dein Abenteuer',body,[btn('Weiter erkunden',closeModal,'primary')]);
}
function showServices(){
 const h=header(),town=['MAP_TYPE_CITY_TOWN','MAP_TYPE_INTERIOR'].includes(h.mapType),buttons=[];
 if(town){buttons.push(btn('Pokécenter · kostenlos heilen',()=>{g.heal();g.s.lastCenter={map:g.s.map,x:g.s.x,y:g.s.y};g.save();closeModal();toast('Dein Team ist wieder fit. KP, AP und Status wurden geheilt.');showWorld();},'primary'),btn('Pokémon-Markt',()=>{closeModal();showShop();}));}
 buttons.push(btn('PC öffnen',()=>{closeModal();showBoxes();}),btn('Arenen & Orden',()=>{closeModal();showGyms();}));
 modal(h.name,el('p',{},town?'Hier kannst du dein Team heilen oder einkaufen.':'Auf dieser Route gibt es kein Pokécenter und keinen Markt. Per Karte kannst du jederzeit in eine Stadt reisen.'),buttons);
}
function showTeam(battleSwitch=false){
 const rows=el('div',{class:'scroll'});for(let i=0;i<g.s.party.length;i++){const m=g.s.party[i],info=el('div',{class:'grow'},el('h3',{},g.name(m)+' · Lv. '+m.level),typeTags(m),hpbar(m),el('small',{},m.hp+'/'+g.stats(m)[0]+' KP'+(m.status?' · '+PWF.statusLabel[m.status]:'')));
  const buttons=battleSwitch?[btn('Einwechseln',()=>{g.switch(i);showBattle();},'primary',m.hp<=0||i===g.battle.active)]:[btn('Details',()=>monDetails(m,i)),btn('Nach vorn',()=>{if(i){[g.s.party[0],g.s.party[i]]=[g.s.party[i],g.s.party[0]];g.save();showTeam();}},'quiet',i===0)];rows.append(el('div',{class:'row'},art(m.species),info,buttons));}
 showPage('team',[titleHead('Dein Team',g.s.party.length+'/6 Pokémon · KP, AP und Erfahrung werden gespeichert.',[btn(battleSwitch?'Zum Kampf':'Zurück',()=>battleSwitch?showBattle():showWorld(),'quiet'),!battleSwitch?btn('PC / Boxen',showBoxes):null].filter(Boolean)),rows]);
}
function monDetails(m,index){const stats=g.stats(m);modal(g.name(m)+' · Level '+m.level,el('div',{},el('div',{class:'row'},art(m.species),el('div',{},typeTags(m),el('p',{},'Fähigkeit: '+(data.abilities[m.ability]||'—')),el('p',{},'EP: '+m.exp+' · Nächstes Level: '+(m.level<100?g.threshold(m.species,m.level+1):'Maximum')),el('p',{},'Getragen: '+(m.item?g.itemName(m.item):'—')))),...['KP','Angriff','Verteidigung','Initiative','Spezial-Angriff','Spezial-Verteidigung'].map((name,i)=>el('div',{class:'stat-line'},name,stats[i])),el('h3',{style:'margin-top:15px'},'Attacken'),m.moves.map(p=>el('div',{class:'row'},el('div',{class:'grow'},data.moves[p.id].name),el('small',{},p.pp+'/'+g.maxPP(p)+' AP')))),[btn('Attacke erinnern',()=>learnMove(m,index)),btn('In Box '+(boxIndex+1)+' ablegen',()=>{g.deposit(index,boxIndex);closeModal();showTeam();},'quiet',g.s.party.length<=1)]);}
function learnMove(m,index){const moves=[...new Set(g.species(m).learn.filter(([l])=>l<=m.level).map(([,id])=>id))];modal('Attacke erinnern',el('div',{},el('p',{},'Wähle eine bereits nach Level verfügbare Attacke. Die Erinnerung ist im freien Modus kostenlos.'),moves.map(id=>btn(data.moves[id].name,()=>chooseMoveSlot(m,slot=>{m.moves[slot]={id,pp:data.moves[id].pp,ups:0};g.save();closeModal();showTeam();}),'quiet'))));}
function chooseMoveSlot(m,callback){if(m.moves.length<4){callback(m.moves.length);return;}modal('Welche Attacke ersetzen?',el('div',{class:'grid'},m.moves.map((p,i)=>btn(data.moves[p.id].name,()=>callback(i),'quiet'))));}
function showBoxes(){
 const grid=el('div',{class:'grid'}),select=el('select',{'aria-label':'Box'});for(let i=0;i<18;i++)select.append(el('option',{value:i},'Box '+(i+1)+' · '+g.s.boxes[i].filter(Boolean).length+'/30'));select.value=boxIndex;select.onchange=()=>{boxIndex=Number(select.value);showBoxes();};
 g.s.boxes[boxIndex].forEach((m,slot)=>grid.append(m?el('article',{class:'card'},art(m.species),el('h3',{},g.name(m)),el('small',{},'Level '+m.level),btn('Ins Team',()=>{g.withdraw(boxIndex,slot);showBoxes();},'primary',g.s.party.length>=6)):el('article',{class:'card'},el('small',{},'Platz '+(slot+1)),el('p',{class:'muted'},'Leer'))));
 showPage('boxes',[titleHead('Dein Pokémon-PC','18 Boxen × 30 Plätze · Ein kampffähiges Pokémon bleibt im Team.',[backButton(),btn('Team ablegen',()=>{showTeam();toast('Bei Details kannst du Pokémon in die gewählte Box ablegen.');})]),select,el('div',{class:'scroll'},grid)]);
}
function showDex(freeEncounter=false){
 let input=el('input',{placeholder:'Name oder Pokédex-Nummer …',value:dexQuery}),grid=el('div',{class:'grid'}),notice=el('p',{class:'notice'},freeEncounter?'Freie Begegnungen ergänzen die originalen Routentabellen: Jede Art ist dadurch ohne Story- oder Tauschzwang fangbar.':'493 Arten · Gesehen '+g.s.seen.length+' · Gefangen '+g.s.caught.length);
 const render=()=>{const q=dexQuery.toLowerCase();grid.replaceChildren(...data.species.filter(Boolean).filter(s=>s.name.toLowerCase().includes(q)||String(s.id)===q).map(s=>el('article',{class:'card'},art(s.id),el('small',{},'#'+String(s.id).padStart(3,'0')+(g.s.caught.includes(s.id)?' · GEFANGEN':g.s.seen.includes(s.id)?' · GESEHEN':'')),el('h3',{},s.name),btn(freeEncounter?'Begegnen':'Ansehen',()=>freeEncounter?chooseWild(s):dexDetail(s),'quiet'))));};input.oninput=()=>{dexQuery=input.value;render();};render();showPage('dex',[titleHead('Der Pokédex',g.s.caught.length+' / 493 Arten gefangen',[backButton(),btn(freeEncounter?'Pokédex':'Freie Begegnung',()=>showDex(!freeEncounter),'primary')]),input,notice,el('div',{class:'scroll'},grid)]);
}
function dexDetail(s){modal('#'+s.id+' · '+s.name,el('div',{},art(s.id),el('p',{},data.descriptions[s.id]||''),el('p',{},[...new Set(s.types)].map(t=>PWF.TYPES[t]).join(' / ')),el('p',{},'Basiswerte: '+s.stats.join(' · '))),[btn('Freie Begegnung',()=>chooseWild(s),'primary')]);}
function chooseWild(s){const level=el('input',{type:'number',min:1,max:100,value:Math.max(...g.s.party.map(m=>m.level)),'aria-label':'Level'});modal(s.name+' begegnen',el('div',{},el('p',{},'Eine zusätzliche Begegnung im freien Modus. Level 1 bis 100; das Pokémon muss im Kampf gefangen werden.'),level),[btn('Begegnung starten',()=>{let n=Number(level.value);if(!Number.isInteger(n)||n<1||n>100)throw Error('Bitte ein Level zwischen 1 und 100 wählen.');closeModal();g.startWild(s.id,n);showBattle();},'primary')]);}
function showBag(inBattle=false){
 const rows=el('div',{class:'scroll'});Object.entries(g.s.bag).filter(([id,n])=>n>0).sort((a,b)=>Number(a[0])-Number(b[0])).forEach(([key,n])=>{const id=Number(key);rows.append(el('div',{class:'row'},el('div',{class:'grow'},el('h3',{},g.itemName(id)),el('small',{},'Anzahl: '+n)),btn('Einsetzen',()=>{
   if(inBattle&&(id<=16||/ball$/i.test(g.itemName(id)))){g.catch(id);showBattle();return;}
   if([76,77,79].includes(id)&&!inBattle){g.s.repel=id===76?200:id===77?250:100;g.s.bag[id]--;g.save();toast('Schutz aktiviert.');showBag();return;}
   choosePartyTarget('Item einsetzen',m=>{const index=g.s.party.indexOf(m);const apply=slot=>{closeModal();if(inBattle){g.useInBattle(id,index,slot);showBattle();}else{g.item(id,index,slot).forEach(toast);showBag();}};if(id>=328&&id<=427)chooseMoveSlot(m,apply);else if(data.items[id]?.flags?.[5]&1)modal('AP wiederherstellen',el('div',{class:'grid'},m.moves.map((p,i)=>btn(data.moves[p.id].name+' · '+p.pp+'/'+g.maxPP(p)+' AP',()=>apply(i),'quiet',p.pp>=g.maxPP(p)))));else apply(0);});
  },'primary'),!inBattle?btn('Geben',()=>choosePartyTarget('Item geben',m=>{g.equip(id,g.s.party.indexOf(m));closeModal();showBag();}),'quiet'):null));});
 showPage('bag',[titleHead('Dein Beutel',money()+' · Pokébälle, Medizin, TMs und gehaltene Items',[btn(inBattle?'Zum Kampf':'Zurück',()=>inBattle?showBattle():showWorld(),'quiet')]),rows]);
}
function choosePartyTarget(title,callback){modal(title,el('div',{},g.s.party.map(m=>el('div',{class:'row'},art(m.species),el('div',{class:'grow'},g.name(m)+' · '+m.hp+'/'+g.stats(m)[0]+' KP'),btn('Wählen',()=>callback(m),'primary')))));}
function showShop(){
 let input=el('input',{placeholder:'Item suchen …'}),rows=el('div',{class:'scroll'}),balance=el('span',{},money());
 const render=()=>{balance.textContent=money();const q=input.value.toLowerCase();const catalog=data.items.filter(i=>i.id>0&&i.price>0&&i.name.toLowerCase().includes(q));if(!q)catalog.sort((a,b)=>{const fav=[4,3,2,17,26,25,24,28,18,19,20,21,22,27];return (fav.includes(a.id)?fav.indexOf(a.id):999)-(fav.includes(b.id)?fav.indexOf(b.id):999);});
  rows.replaceChildren(...catalog.map(item=>el('div',{class:'row'},el('div',{class:'grow'},el('h3',{},item.name),el('small',{},item.price+' ₽ · Im Beutel: '+g.quantity(item.id))),btn('Kaufen',()=>{g.buy(item.id);render();},'primary',g.s.money<item.price),btn('Verkaufen',()=>{g.sell(item.id);render();},'quiet',g.quantity(item.id)===0))));
  if('link-kabel'.includes(q)||!q)rows.prepend(el('div',{class:'row'},el('div',{class:'grow'},el('h3',{},'Link-Kabel'),el('small',{},'2.000 ₽ · Tauschentwicklungen ohne Tausch')),btn('Kaufen',()=>{g.buy(9000);render();},'primary',g.s.money<2000)));
 };input.oninput=render;render();showPage('shop',[titleHead('Pokémon-Markt','Freier Markt: alle importierten käuflichen Items. Nicht jeder Spezialeffekt ist bereits umgesetzt.',[backButton(),balance]),input,rows]);
}
function showGyms(){
 const grid=el('div',{class:'grid'});for(const gym of data.gyms){const t=data.trainers[gym.trainer],won=g.s.badges.includes(gym.id);grid.append(el('article',{class:'card'},el('div',{class:'badge '+(won?'':'locked')},'◆'),el('small',{},gym.region+' · '+(won?'GEWONNEN':'OFFEN')),el('h3',{},t.name),el('p',{},gym.badge),el('small',{},t.party.map(p=>data.species[p.species].name+' '+p.level).join(' · ')),btn(won?'Erneut kämpfen':'Herausfordern',()=>{g.startTrainer(gym.trainer,gym.id);showBattle();},'primary')));}
 showPage('gyms',[titleHead('Deine Orden',g.s.badges.length+' von 16 · Jede Arena ist unabhängig herausforderbar.',[backButton(),btn('Trainerkämpfe',showTrainerBattles,'quiet')]),el('div',{class:'scroll'},grid)]);
}
function showTrainerBattles(){const input=el('input',{placeholder:'Trainername …'}),rows=el('div',{class:'scroll'});const render=()=>{rows.replaceChildren(...data.trainers.filter(t=>t.party.length&&t.name.toLowerCase().includes(input.value.toLowerCase())).map(t=>el('div',{class:'row'},el('div',{class:'grow'},el('h3',{},t.name+' #'+t.id),el('small',{},t.party.map(p=>'Lv. '+p.level+' '+data.species[p.species].name).join(' · '))),btn('Kämpfen',()=>{g.startTrainer(t.id);showBattle();},'primary'))));};input.oninput=render;render();showPage('trainers-battle',[titleHead('Freie Trainerkämpfe','Originale Teams aus HeartGold; auch Wiederholungen sind möglich.',[backButton()]),input,rows]);}
function destinationFor(h){for(const key of h.cells){const cell=world.cells[key];if(cell&&!world.jobs[cell.asset].error){let p=nearest(cell);if(p)return {key,x:p[0],y:p[1]};}}return null;}
function showTravel(){
 const canvas=el('canvas',{class:'world-map',width:752,height:272}),ctx=canvas.getContext('2d'),input=el('input',{placeholder:'Stadt, Route oder Innenraum suchen …',value:travelQuery}),select=el('select'),rows=el('div',{class:'scroll'});
 for(const r of ['Alle','Johto','Kanto'])select.append(el('option',{value:r},r));select.value=travelRegion;
 const draw=()=>{ctx.fillStyle='#10251e';ctx.fillRect(0,0,752,272);for(const c of Object.values(world.cells))if(c.matrix===0){const h=world.headers[c.header];ctx.fillStyle=h.region==='Kanto'?'#83b5a0':'#b7ce79';ctx.fillRect(c.x*16+1,c.y*16+1,14,14);}const c=mapData;if(c.matrix===0){ctx.fillStyle='#f3e6b6';ctx.beginPath();ctx.arc(c.x*16+8,c.y*16+8,6,0,Math.PI*2);ctx.fill();}};
 const render=()=>{const q=travelQuery.toLowerCase(),list=Object.values(world.headers).filter(h=>h.id>1&&h.cells.length&&(travelRegion==='Alle'||h.region===travelRegion)&&(h.name.toLowerCase().includes(q)||h.key.toLowerCase().includes(q))).filter(h=>q||h.matrixId===0||h.mapType==='MAP_TYPE_CAVE');
  rows.replaceChildren(...list.map(h=>el('div',{class:'row'},el('div',{class:'grow'},el('h3',{},h.name),el('small',{},h.region+' · '+h.key.replace('MAP_','').replaceAll('_',' ').toLowerCase())),btn('Reisen',async()=>{let p=destinationFor(h);if(!p)throw Error('Kein begehbarer Abschnitt verfügbar.');await loadMap(p.key,p.x,p.y);showWorld();toast(h.name);},'primary'))));};
 input.oninput=()=>{travelQuery=input.value;render();};select.onchange=()=>{travelRegion=select.value;render();};draw();render();showPage('travel',[titleHead('Johto & Kanto','Alle Orte sind offen. Suche auch nach Innenräumen; Türen und Routengrenzen verbinden die Karten.',[backButton()]),canvas,el('div',{class:'filters'},input,select),rows]);
}
function showSave(){
 modal('Dein Spielstand',el('div',{},el('p',{},'Automatisch gespeichert nach Kämpfen, Käufen, Box-Aktionen und beim Verlassen der App. Eine Sicherung schützt deinen Fortschritt bei einer Neuinstallation.'),el('p',{},g?g.s.name+' · '+g.s.caught.length+' Arten · '+g.s.badges.length+' Orden':'')),[btn('Jetzt speichern',()=>{g.save();toast('Speichervorgang abgeschlossen.');},'primary'),btn('Sicherung exportieren',()=>window.Android?Android.exportSave(JSON.stringify(g.s)):toast('Export ist in der Android-App verfügbar.')),btn('Sicherung importieren',()=>window.Android?Android.importSave():toast('Import ist in der Android-App verfügbar.'),'quiet')]);
}
function showBattle(){
 closeModal();page='battle';clearInput();const b=g.battle;if(!b){showWorld();return;}const player=g.s.party[b.active],enemy=b.enemies[Math.min(b.enemy,b.enemies.length-1)];
 const info=m=>el('div',{class:'mon-info'},el('h3',{},g.name(m),el('span',{},'Lv. '+m.level)),hpbar(m),el('small',{},m.hp+'/'+g.stats(m)[0]+' KP'+(m.status?' · '+PWF.statusLabel[m.status]:'')));
 const arena=el('div',{class:'arena'},el('div',{class:'topbar'},b.trainer===null?'WILDES POKÉMON':b.title),el('div',{class:'battler enemy'},info(enemy),art(enemy.species)),el('div',{class:'battler player'},art(player.species,'back'),info(player)));
 const options=el('div',{class:'battle-options'});
 if(b.result)options.append(btn('Weiter erkunden',finishBattle,'primary'));
 else if(player.hp<=0)options.append(btn('Pokémon einwechseln',()=>showTeam(true),'primary'));
 else{
  player.moves.forEach((p,i)=>{const m=data.moves[p.id];options.append(btn(el('span',{},m.name,el('small',{},PWF.TYPES[m.type]+' · '+p.pp+'/'+g.maxPP(p)+' AP'+(m.power?' · Stärke '+m.power:''))),()=>{g.turn(i);showBattle();},'quiet',p.pp<=0&&player.moves.some(x=>x.pp>0)));});
  options.append(el('div',{class:'utility'},btn('Beutel',()=>showBag(true)),btn('Wechseln',()=>showTeam(true)),btn('Flucht',()=>{g.escape();showBattle();},'',b.trainer!==null)));
 }
 const log=el('div',{class:'battle-log','aria-live':'polite'},b.log.slice(-30).map(t=>el('p',{},t)));app.replaceChildren(el('div',{class:'battle'},arena,el('div',{class:'battle-bottom'},log,options)));log.scrollTop=log.scrollHeight;
}
async function finishBattle(){const b=g.battle;if(!b?.result)return;g.battle=null;g.save();if(b.result==='loss'){const place=g.s.lastCenter||world.start;await loadMap(place.map,place.x,place.y);}showWorld();}
window.addEventListener('keydown',e=>{const k=e.key.toLowerCase();if(['input','select','textarea'].includes(document.activeElement?.tagName?.toLowerCase()))return;if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(k)&&page==='world'&&!modalOpen){held.add(k);e.preventDefault();}if((k==='e'||k==='enter')&&page==='world'&&!modalOpen){e.preventDefault();if(!e.repeat)run(interact);}if(k==='escape'){e.preventDefault();window.pwfBack();}});
window.addEventListener('keyup',e=>held.delete(e.key.toLowerCase()));window.addEventListener('blur',clearInput);document.addEventListener('visibilitychange',()=>{if(document.hidden)window.pwfPause();});
