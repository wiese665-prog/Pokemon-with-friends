/* Free-roam RPG rules. No Android or DOM dependency: tested with node:test. */
(function(root,factory){const api=factory();if(typeof module==='object')module.exports=api;else root.PWF=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const TYPES=['Normal','Kampf','Flug','Gift','Boden','Gestein','Käfer','Geist','Stahl','???','Feuer','Wasser','Pflanze','Elektro','Psycho','Eis','Drache','Unlicht'];
const stage=n=>n>=0?(2+n)/2:2/(2-n);
const statusLabel={poison:'Vergiftung',toxic:'schwere Vergiftung',burn:'Verbrennung',paralysis:'Paralyse',sleep:'Schlaf',freeze:'Vereisung'};
class Game {
 constructor(data,state=null){this.d=data;this.battle=null;this.onSave=()=>{};this.s=state?this.validate(state):this.fresh();}
 fresh(){return {version:3,seed:Date.now()>>>0,serial:0,name:'GOLD',avatar:69,map:'0_21_12',x:23,y:13,party:[],boxes:Array.from({length:18},()=>Array(30).fill(null)),bag:{4:20,17:5,18:2},money:3000,badges:[],seen:[],caught:[],defeated:[],steps:0,repel:0,visited:['0_21_12']};}
 validate(s){
  if(!s||s.version!==3||!Array.isArray(s.party)||s.party.length>6||!Array.isArray(s.boxes)||s.boxes.length!==18||!Number.isInteger(s.money)||s.money<0||s.money>9999999)throw Error('Ungültiger Spielstand');
  const ids=new Set();for(const box of s.boxes)if(!Array.isArray(box)||box.length!==30)throw Error('Ungültige Boxen');
  for(const m of [...s.party,...s.boxes.flat()].filter(Boolean)){
   if(!this.d.species[m.species]||!Number.isInteger(m.level)||m.level<1||m.level>100||!m.id||ids.has(m.id)||!Array.isArray(m.moves)||m.moves.length<1||m.moves.length>4||!Array.isArray(m.iv)||m.iv.length!==6||!Array.isArray(m.ev)||m.ev.length!==6)throw Error('Ungültige Pokémon-Daten');
   ids.add(m.id);if(!m.moves.every(x=>this.d.moves[x.id]&&Number.isInteger(x.pp)&&x.pp>=0))throw Error('Ungültige Attacken');
   if(m.iv.some(x=>!Number.isInteger(x)||x<0||x>31)||m.ev.some(x=>!Number.isInteger(x)||x<0||x>255)||m.ev.reduce((a,b)=>a+b,0)>510)throw Error('Ungültige Statuswerte');
   if(!Number.isInteger(m.hp)||m.hp<0||m.hp>this.stats(m)[0])throw Error('Ungültige KP');
  }
  if(Object.entries(s.bag).some(([id,n])=>!(this.d.items[id]||id==='9000')||!Number.isInteger(n)||n<0||n>999))throw Error('Ungültiger Beutel');
  return JSON.parse(JSON.stringify(s));
 }
 rand(){let x=this.s.seed|0;x^=x<<13;x^=x>>>17;x^=x<<5;this.s.seed=x>>>0;return this.s.seed/4294967296;}
 int(a,b){return a+Math.floor(this.rand()*(b-a+1));}
 save(){this.onSave(JSON.stringify(this.s));}
 species(m){return this.d.species[m.species];}
 name(m){return m.nickname||this.species(m).name;}
 threshold(species,level){return this.d.growth[this.d.species[species].growth][clamp(level,0,100)];}
 stats(m){const b=this.species(m).stats;return b.map((v,i)=>{
   let n=Math.floor((2*v+m.iv[i]+Math.floor(m.ev[i]/4))*m.level/100);
   if(i===0)return m.species===292?1:n+m.level+10;
   n+=5;const up=Math.floor(m.nature/5)+1,down=m.nature%5+1;return Math.floor(n*(up===down?1:up===i?1.1:down===i?.9:1));
 });}
 create(species,level=5,moves=null){
  if(!this.d.species[species])throw Error('Dieses Pokémon ist nicht verfügbar.');
  level=clamp(Math.floor(level),1,100);const sp=this.d.species[species];let ids=[];
  if(moves&&moves.length)ids=moves.filter(id=>this.d.moves[id]);else for(const [l,id] of sp.learn)if(l<=level&&!ids.includes(id))ids.push(id);
  ids=ids.slice(-4);if(!ids.length)ids=[165];
  const m={id:'p'+(++this.s.serial)+'_'+this.int(0,2147483647),species,level,exp:this.threshold(species,level),iv:Array.from({length:6},()=>this.int(0,31)),ev:[0,0,0,0,0,0],nature:this.int(0,24),ability:sp.abilities[1]&&this.rand()<.5?sp.abilities[1]:sp.abilities[0],moves:ids.map(id=>({id,pp:this.d.moves[id].pp,ups:0})),status:'',sleep:0,friendship:70,item:0};
  m.hp=this.stats(m)[0];return m;
 }
 maxPP(move){return Math.floor(this.d.moves[move.id].pp*(1+.2*(move.ups||0)));}
 mark(list,sid){if(!list.includes(sid))list.push(sid);}
 starter(sid){if(this.s.party.length)throw Error('Du hast bereits ein Team.');const m=this.create(sid);this.s.party.push(m);this.mark(this.s.seen,sid);this.mark(this.s.caught,sid);this.save();return m;}
 room(){return this.s.party.length<6||this.s.boxes.some(b=>b.some(m=>m===null));}
 add(m){if(!this.room())throw Error('Team und alle Boxen sind voll.');let where='Team';if(this.s.party.length<6)this.s.party.push(m);else {let box=this.s.boxes.findIndex(b=>b.some(x=>x===null));let slot=this.s.boxes[box].indexOf(null);this.s.boxes[box][slot]=m;where='Box '+(box+1);}
  this.mark(this.s.seen,m.species);this.mark(this.s.caught,m.species);return where;
 }
 deposit(index,box){if(!Number.isInteger(index)||index<0||index>=this.s.party.length||!Number.isInteger(box)||box<0||box>=18)throw Error('Ungültiger Boxplatz.');if(this.battle)throw Error('Im Kampf ist das nicht möglich.');if(this.s.party.length<=1)throw Error('Ein Pokémon muss im Team bleiben.');if(!this.s.party.some((m,i)=>i!==index&&m.hp>0))throw Error('Mindestens ein kampffähiges Pokémon muss im Team bleiben.');let slot=this.s.boxes[box].indexOf(null);if(slot<0)throw Error('Diese Box ist voll.');this.s.boxes[box][slot]=this.s.party.splice(index,1)[0];this.save();}
 withdraw(box,slot){if(!Number.isInteger(box)||box<0||box>=18||!Number.isInteger(slot)||slot<0||slot>=30)throw Error('Ungültiger Boxplatz.');if(this.battle)throw Error('Im Kampf ist das nicht möglich.');if(this.s.party.length>=6)throw Error('Dein Team ist voll.');let m=this.s.boxes[box][slot];if(!m)throw Error('Dieser Platz ist leer.');this.s.boxes[box][slot]=null;this.s.party.push(m);this.save();}
 heal(){for(const m of this.s.party){m.hp=this.stats(m)[0];m.status='';for(const p of m.moves)p.pp=this.maxPP(p);}this.save();}
 quantity(id){return this.s.bag[id]||0;}
 itemName(id){return id===9000?'Link-Kabel':this.d.items[id]?.name||'Item '+id;}
 buy(id,n=1){if(this.battle)throw Error('Kein Einkauf im Kampf.');const price=id===9000?2000:this.d.items[id]?.price;if(!price||!Number.isInteger(n)||n<1||n>99)throw Error('Dieses Item ist nicht käuflich.');if(this.quantity(id)+n>999)throw Error('Mehr passt nicht in den Beutel.');if(this.s.money<price*n)throw Error('Nicht genug Geld.');this.s.money-=price*n;this.s.bag[id]=this.quantity(id)+n;this.save();}
 sell(id,n=1){if(this.battle)throw Error('Kein Verkauf im Kampf.');const price=this.d.items[id]?.price||0;if(!price||n<1||!Number.isInteger(n)||this.quantity(id)<n)throw Error('Dieses Item kann nicht verkauft werden.');this.s.bag[id]-=n;this.s.money=Math.min(9999999,this.s.money+Math.floor(price/2)*n);this.save();}
 evolve(m,method,item=0){
  const st=this.stats(m),before=st[0];const evo=this.species(m).evolutions.find(([kind,p])=>{
   if(method==='item')return kind===7&&p===item||item===9000&&(kind===5||kind===6&&m.item===p);
   return kind===4&&m.level>=p||[1,2,3].includes(kind)&&m.friendship>=220||kind===8&&m.level>=p&&st[1]>st[2]||kind===9&&m.level>=p&&st[1]<st[2]||kind===10&&m.level>=p&&st[1]===st[2]||kind===20&&m.moves.some(x=>x.id===p);
  });
  if(!evo)return '';let old=this.name(m);if(evo[0]===6)m.item=0;m.species=evo[2];m.hp=Math.max(1,m.hp+this.stats(m)[0]-before);m.ability=this.species(m).abilities[0];this.mark(this.s.seen,m.species);this.mark(this.s.caught,m.species);return old+' entwickelt sich zu '+this.name(m)+'!';
 }
 item(id,index=0,moveSlot=0){
  if(!this.quantity(id))throw Error('Dieses Item hast du nicht.');let m=this.s.party[index];if(!m)throw Error('Kein Pokémon ausgewählt.');let used=false,log=[];const max=this.stats(m)[0],item=this.d.items[id];
  if(id===9000||this.species(m).evolutions.some(([k,p])=>k===7&&p===id)){const text=this.evolve(m,'item',id);if(!text)throw Error('Keine passende Entwicklung.');log.push(text);used=true;}
  else if(id===50){if(m.level>=100)throw Error('Höchstlevel erreicht.');this.gain(m,this.threshold(m.species,m.level+1)-m.exp,log);used=true;}
  else if([28,29].includes(id)){if(m.hp>0)throw Error('Dieses Pokémon ist nicht besiegt.');m.hp=id===28?Math.ceil(max/2):max;used=true;}
  else if(item&&item.flags){
   const f=item.flags;if(m.hp>0&&m.hp<max&&(f[5]&4)){let hp=item.heal;if(hp===255)hp=max;if(hp===254)hp=Math.floor(max/2);m.hp=Math.min(max,m.hp+hp);used=hp>0;}
   const cures={sleep:1,poison:2,toxic:2,burn:4,freeze:8,paralysis:16};if(m.status&&(f[0]&cures[m.status])){m.status='';used=true;}
   if((f[5]&3)&&m.hp>0){const all=!!(f[5]&2);for(let i=0;i<m.moves.length;i++)if(all||i===moveSlot){let p=m.moves[i],n=this.maxPP(p);if(p.pp<n){p.pp=Math.min(n,p.pp+(item.pp===127?n:item.pp));used=true;}}}
  }
  if(id>=328&&id<=427){const tm=id-328,move=this.d.tmMoves?.[tm];if(!move||!this.species(m).tm.includes(tm))throw Error('Dieses Pokémon kann diese TM/VM nicht lernen.');if(m.moves.some(x=>x.id===move))throw Error('Attacke bereits gelernt.');let p={id:move,pp:this.d.moves[move].pp,ups:0};if(m.moves.length<4)m.moves.push(p);else m.moves[clamp(moveSlot,0,3)]=p;used=true;log.push(this.d.moves[move].name+' wurde gelernt.');}
  if(!used)throw Error('Dieses Item hat hier keine Wirkung.');if(id<420||id>427)this.s.bag[id]--;log.push(this.itemName(id)+' eingesetzt.');this.save();return log;
 }
 equip(id,index){if(id===9000||!this.d.items[id]||!this.s.party[index])throw Error('Dieses Item kann nicht getragen werden.');if(!this.quantity(id))throw Error('Item fehlt.');const m=this.s.party[index];if(m.item){if(this.quantity(m.item)>=999)throw Error('Beutel ist voll.');this.s.bag[m.item]=this.quantity(m.item)+1;}m.item=id;this.s.bag[id]--;this.save();}
 gain(m,amount,log=[]){
  const old=m.level;m.exp=Math.min(this.threshold(m.species,100),m.exp+Math.max(0,Math.floor(amount)));
  while(m.level<100&&m.exp>=this.threshold(m.species,m.level+1)){
   const hp=this.stats(m)[0];m.level++;m.hp+=this.stats(m)[0]-hp;m.friendship=Math.min(255,m.friendship+3);log.push(this.name(m)+' erreicht Level '+m.level+'.');
   for(const [level,id] of this.species(m).learn)if(level===m.level&&!m.moves.some(x=>x.id===id)){if(m.moves.length===4){m.moves.shift();}m.moves.push({id,pp:this.d.moves[id].pp,ups:0});log.push(this.name(m)+' lernt '+this.d.moves[id].name+'.');}
   const evolved=this.evolve(m,'level');if(evolved)log.push(evolved);
  }return m.level-old;
 }
 effectiveness(type,def){let mul=1;for(const t of new Set(this.species(def).types))mul*=this.d.typeChart.find(row=>row[0]===type&&row[1]===t)?.[2]??1;return mul;}
 encounter(index,water=false,time='day'){
  let e=this.d.encounters[index];if(!e)return null;
  if(water){const slot=e.surf[this.int(0,4)];if(!slot||!slot[2])return null;return [slot[2],this.int(slot[0],slot[1])];}
  let roll=this.int(0,99),weights=[20,20,10,10,10,10,5,5,4,4,1,1],slot=0;for(;slot<11;slot++){roll-=weights[slot];if(roll<0)break;}
  let sid=(e[time]||e.day)[slot];return sid?[sid,e.levels[slot]]:null;
 }
 startWild(species,level){return this.begin([this.create(species,level)],null,null);}
 startTrainer(id,gym=null){const trainer=this.d.trainers[id];if(!trainer?.party.length)throw Error('Trainer hat kein Team.');return this.begin(trainer.party.map(p=>{const m=this.create(p.species,p.level,p.moves);m.item=p.item;return m;}),trainer,gym);}
 begin(enemies,trainer,gym){
  const active=this.s.party.findIndex(m=>m.hp>0);if(active<0)throw Error('Dein Team braucht ein Pokécenter.');
  this.battle={enemies,enemy:0,active,trainer:trainer?.id??null,title:trainer?.name||'Wildes Pokémon',gym,log:[],stages:[Array(7).fill(0),Array(7).fill(0)],volatile:[{},{}],participants:[this.s.party[active].id],weather:'',weatherTurns:0,turn:0,result:null};
  this.mark(this.s.seen,enemies[0].species);this.log(trainer?trainer.name+' fordert dich heraus!':'Ein wildes '+this.name(enemies[0])+' erscheint!');this.entryAbility(0);this.entryAbility(1);return this.battle;
 }
 log(text){this.battle?.log.push(text);}
 mons(){return [this.s.party[this.battle.active],this.battle.enemies[this.battle.enemy]];}
 entryAbility(side){let m=this.mons()[side];if(m.ability===22){this.battle.stages[1-side][0]=clamp(this.battle.stages[1-side][0]-1,-6,6);this.log('Bedroher senkt den Angriff.');}}
 status(m,status){if(m.status)return false;const types=this.species(m).types;if(status==='burn'&&(types.includes(10)||m.ability===41)||['poison','toxic'].includes(status)&&(types.includes(3)||types.includes(8)||m.ability===17)||status==='freeze'&&(types.includes(15)||m.ability===40)||status==='paralysis'&&m.ability===7||status==='sleep'&&[15,72].includes(m.ability))return false;
  m.status=status;m.sleep=status==='sleep'?this.int(1,3):0;this.log(this.name(m)+': '+statusLabel[status]+'.');return true;
 }
 effectiveStat(m,idx,side){let value=this.stats(m)[idx]*stage(this.battle.stages[side][idx-1]);if(idx===3&&m.status==='paralysis')value/=4;if(idx===1&&m.status==='burn'&&m.ability!==62)value/=2;if(idx===1&&[37,74].includes(m.ability))value*=2;if(idx===1&&m.status&&m.ability===62)value*=1.5;return value;}
 canAct(m,side){const v=this.battle.volatile[side];
  if(m.status==='sleep'){if(m.sleep-->0){this.log(this.name(m)+' schläft.');return false;}m.status='';this.log(this.name(m)+' wacht auf.');}
  if(m.status==='freeze'){if(this.rand()>.2){this.log(this.name(m)+' ist eingefroren.');return false;}m.status='';}
  if(m.status==='paralysis'&&this.rand()<.25){this.log(this.name(m)+' ist paralysiert!');return false;}
  if(v.flinch){v.flinch=false;this.log(this.name(m)+' schreckt zurück.');return false;}
  if(v.confusion>0){v.confusion--;if(this.rand()<.5){let d=Math.max(1,Math.floor((2*m.level/5+2)*40*this.stats(m)[1]/this.stats(m)[2]/50+2));m.hp=Math.max(0,m.hp-d);this.log(this.name(m)+' verletzt sich vor Verwirrung.');return false;}}
  return true;
 }
 damage(att,def,move,side,critical=false){
  const eff=this.effectiveness(move.type,def);let ability=def.ability;
  if(move.type===4&&ability===26||move.type===10&&ability===18||move.type===11&&[11,87].includes(ability)||move.type===13&&[10,78].includes(ability))return {damage:0,effect:0,absorb:[10,11,87].includes(ability)};
  if(!eff)return {damage:0,effect:0};const effect=move.effect;
  let amount;
  if(effect.includes('ONE_HIT_KO'))amount=att.level<def.level?0:this.stats(def)[0];
  else if(effect.includes('HALVE_HP'))amount=Math.max(1,Math.floor(def.hp/2));
  else if(effect.includes('40_DAMAGE_FLAT'))amount=40;
  else if(effect.includes('20_DAMAGE_FLAT'))amount=20;
  else if(effect.includes('LEVEL_DAMAGE_FLAT'))amount=att.level;
  else {
   let power=move.power||1;
   if(att.ability===101&&power<=60)power*=1.5;
   if(att.hp<=this.stats(att)[0]/3&&[[65,12],[66,10],[67,11],[68,6]].some(([a,t])=>a===att.ability&&t===move.type))power*=1.5;
   if(effect.includes('DOUBLE_DAMAGE_STATUS')&&def.status)power*=2;
   if(effect.includes('DOUBLE_POWER_LOW_HP'))power*=Math.max(1,Math.floor(this.stats(att)[0]/Math.max(1,att.hp)));
   let a=this.effectiveStat(att,move.category===1?4:1,side),d=this.effectiveStat(def,move.category===1?5:2,1-side);
   amount=Math.floor(Math.floor(Math.floor((2*att.level/5+2)*power*a/d)/50)+2);
   if(critical)amount*=2;
   if(this.species(att).types.includes(move.type))amount*=att.ability===91?2:1.5;
   amount*=eff*(.85+this.rand()*.15);
   if(ability===47&&[10,15].includes(move.type))amount*=.5;
   if(this.battle.weather==='rain')amount*=move.type===11?1.5:move.type===10?.5:1;
   if(this.battle.weather==='sun')amount*=move.type===10?1.5:move.type===11?.5:1;
  }
  return {damage:Math.max(1,Math.floor(amount)),effect:eff};
 }
 attack(side,slot){
  const b=this.battle,[att,def]=side===0?this.mons():this.mons().reverse(),v=b.volatile[side],dv=b.volatile[1-side];
  if(att.hp<=0||def.hp<=0||!this.canAct(att,side))return;
  let selected=att.moves[slot],move=selected?this.d.moves[selected.id]:this.d.moves[165];
  if(selected&&selected.pp<=0){if(att.moves.some(p=>p.pp>0)){this.log('Keine AP übrig.');return;}selected=null;move=this.d.moves[165];}
  if(selected)selected.pp=Math.max(0,selected.pp-(def.ability===46?2:1));
  this.log(this.name(att)+' setzt '+move.name+' ein!');const effect=move.effect;
  const acc=stage(b.stages[side][5]-b.stages[1-side][6]);
  if(move.accuracy&&this.rand()*100>move.accuracy*acc&&!effect.includes('BYPASS_ACCURACY')){this.log('Die Attacke geht daneben.');return;}
  if(dv.protect&&!effect.includes('BYPASS_PROTECT')){this.log(this.name(def)+' schützt sich.');return;}
  if(effect.includes('PROTECT')){v.protect=true;return;}
  if(effect.includes('CHARGE')&&!v.charged){v.charged=true;this.log(this.name(att)+' lädt die Attacke auf.');return;}v.charged=false;
  if(effect.includes('SLEEP')&&effect.includes('RECOVER_DAMAGE')){att.hp=this.stats(att)[0];att.status='sleep';att.sleep=2;return;}
  if(effect.includes('RESTORE_HALF_HP')||effect.includes('HEAL_HALF')){att.hp=Math.min(this.stats(att)[0],att.hp+Math.floor(this.stats(att)[0]/2));return;}
  if(effect.includes('WEATHER')||effect.includes('RAIN')||effect.includes('SUNNY')||effect.includes('SANDSTORM')||effect==='HAIL'){
   b.weather=effect.includes('RAIN')?'rain':effect.includes('SUN')?'sun':effect.includes('SAND')?'sand':'hail';b.weatherTurns=5;this.log('Das Wetter ändert sich.');if(!move.power)return;
  }
  let total=0;
  if(move.power||move.category!==2&&/DAMAGE|HALVE_HP|ONE_HIT/.test(effect)){
   let hits=effect.includes('MULTI_HIT')?(att.ability===92?5:[2,2,2,3,3,3,4,5][this.int(0,7)]):effect.includes('HIT_TWICE')?2:1;
   for(let i=0;i<hits&&def.hp>0;i++){
    const critical=this.rand()<(effect.includes('CRITICAL')?1/8:1/16);const result=this.damage(att,def,move,side,critical);
    if(result.absorb){def.hp=Math.min(this.stats(def)[0],def.hp+Math.floor(this.stats(def)[0]/4));this.log('Die Fähigkeit absorbiert die Attacke.');break;}
    let damage=result.damage;
    if(dv.substitute>0){dv.substitute-=damage;this.log('Der Delegator fängt den Treffer ab.');}else{def.hp=Math.max(0,def.hp-damage);total+=damage;}
    if(result.effect===0)this.log('Keine Wirkung.');else if(result.effect>=2)this.log('Sehr effektiv!');else if(result.effect<1)this.log('Nicht sehr effektiv.');if(critical&&damage)this.log('Volltreffer!');
    if(i===0&&hits>1)this.log('Mehrfachtreffer.');
   }
  }
  const proc=move.category===2||this.rand()*100<(move.chance||0);
  if(proc&&def.hp>0){
   if(effect.includes('BADLY_POISON'))this.status(def,'toxic');else if(effect.includes('POISON'))this.status(def,'poison');
   else if(effect.includes('BURN'))this.status(def,'burn');else if(effect.includes('FREEZE'))this.status(def,'freeze');
   else if(effect.includes('PARALYZE')||effect.includes('PARALYSIS'))this.status(def,'paralysis');else if(effect.includes('STATUS_SLEEP'))this.status(def,'sleep');
   if(effect.includes('CONFUSE')){dv.confusion=this.int(2,5);this.log(this.name(def)+' ist verwirrt.');}
   if(effect.includes('FLINCH'))dv.flinch=true;
  }
  if(total&&effect.includes('RECOVER_HALF_DAMAGE'))att.hp=Math.min(this.stats(att)[0],att.hp+Math.max(1,Math.floor(total/2)));
  if(total&&effect.includes('RECOIL'))att.hp=Math.max(0,att.hp-Math.max(1,Math.floor(total/(effect.includes('HALF')?2:effect.includes('THIRD')?3:4))));
  if(move.id===165)att.hp=Math.max(0,att.hp-Math.max(1,Math.floor(this.stats(att)[0]/4)));
  if(proc||move.category===2){
   const statNames=['ATK','DEF','SPEED','SP_ATK','SP_DEF','ACC','EVA'];
   let found=false;
   for(let i=0;i<statNames.length;i++){
    const n=statNames[i];if(!new RegExp('(^|_)'+n+'_(UP|DOWN)(_|$)').test(effect))continue;
    if(i<2&&effect.startsWith('SP_'))continue;
    const up=effect.includes(n+'_UP'),target=up?side:1-side,delta=(effect.includes('2')||effect.includes('SHARPLY')?2:1)*(up?1:-1);
    b.stages[target][i]=clamp(b.stages[target][i]+delta,-6,6);this.log((up?this.name(att):this.name(def))+': Statuswert '+(up?'steigt.':'sinkt.'));found=true;
   }
   if(effect==='RESET_STAT_CHANGES')b.stages=[Array(7).fill(0),Array(7).fill(0)];
   if(effect.includes('SUBSTITUTE')){const cost=Math.floor(this.stats(att)[0]/4);if(att.hp>cost){att.hp-=cost;v.substitute=cost;this.log('Ein Delegator erscheint.');}}
   if(!move.power&&!found&&!/SLEEP|POISON|BURN|FREEZE|PARAL|CONFUSE|WEATHER|RAIN|SUN|SAND|HAIL|HEAL|RESTORE|PROTECT|SUBSTITUTE|RESET|RECOVER/.test(effect))this.log('Dieser Spezialeffekt ist in dieser Version noch nicht umgesetzt.');
  }
 }
 enemyMove(){const m=this.mons()[1];let choices=m.moves.map((x,i)=>({i,x,move:this.d.moves[x.id]})).filter(x=>x.x.pp>0);if(!choices.length)return 0;
  const def=this.mons()[0];choices.sort((a,b)=>(b.move.power*this.effectiveness(b.move.type,def))-(a.move.power*this.effectiveness(a.move.type,def)));return this.rand()<.65?choices[0].i:choices[this.int(0,choices.length-1)].i;
 }
 turn(slot){
  if(!this.battle||this.battle.result)throw Error('Kein aktiver Kampf.');let b=this.battle,[p,e]=this.mons();if(p.hp<=0)throw Error('Wähle zuerst ein kampffähiges Pokémon.');
  if(p.moves.some(x=>x.pp>0)&&(!p.moves[slot]||p.moves[slot].pp<=0))throw Error('Keine AP für diese Attacke.');
  b.turn++;b.volatile.forEach(x=>{x.protect=false;x.flinch=false;});let es=this.enemyMove(),pm=this.d.moves[p.moves[slot]?.id||165],em=this.d.moves[e.moves[es]?.id||165];
  let first=pm.priority===em.priority?(this.effectiveStat(p,3,0)===this.effectiveStat(e,3,1)?this.int(0,1):(this.effectiveStat(p,3,0)>this.effectiveStat(e,3,1)?0:1)):(pm.priority>em.priority?0:1);
  this.attack(first,first===0?slot:es);if(this.mons()[0].hp>0&&this.mons()[1].hp>0)this.attack(1-first,first===0?es:slot);this.endTurn();
 }
 residual(m,side){if(m.hp<=0)return;const max=this.stats(m)[0],v=this.battle.volatile[side];let damage=0;
  if(['poison','toxic'].includes(m.status)&&m.ability===90){m.hp=Math.min(max,m.hp+Math.floor(max/8));return;}
  if(m.ability!==98){if(m.status==='poison'||m.status==='burn')damage=Math.max(1,Math.floor(max/8));if(m.status==='toxic'){v.toxic=(v.toxic||0)+1;damage=Math.max(1,Math.floor(max*v.toxic/16));}if(this.battle.weather==='sand'&&!this.species(m).types.some(x=>[4,5,8].includes(x)))damage+=Math.max(1,Math.floor(max/16));if(this.battle.weather==='hail'&&!this.species(m).types.includes(15))damage+=Math.max(1,Math.floor(max/16));}
  if(damage){m.hp=Math.max(0,m.hp-damage);this.log(this.name(m)+' verliert KP.');}
  if(m.item===234)m.hp=Math.min(max,m.hp+Math.max(1,Math.floor(max/16)));
 }
 endTurn(){if(!this.battle)return;const b=this.battle;this.mons().forEach((m,i)=>this.residual(m,i));b.volatile.forEach(v=>{v.protect=false;v.flinch=false;});if(b.weatherTurns>0&&--b.weatherTurns===0)b.weather='';this.checkEnd();this.save();}
 checkEnd(){const b=this.battle;if(!b||b.result)return;let [p,e]=this.mons();
  if(e.hp<=0){this.log(this.name(e)+' wurde besiegt.');const participants=this.s.party.filter(m=>b.participants.includes(m.id)&&m.hp>0);const exp=Math.floor(this.species(e).yieldExp*e.level/7*(b.trainer===null?1:1.5)/Math.max(1,participants.length));
   for(const m of participants){for(let i=0;i<6;i++){const remaining=510-m.ev.reduce((a,b)=>a+b,0);m.ev[i]=Math.min(255,m.ev[i]+Math.min(remaining,this.species(e).evs[i]||0));}this.log(this.name(m)+' erhält '+exp+' EP.');this.gain(m,exp,b.log);}
   if(++b.enemy>=b.enemies.length){b.result='win';if(b.trainer!==null){let money=b.enemies.at(-1).level*80;this.s.money=Math.min(9999999,this.s.money+money);this.mark(this.s.defeated,b.trainer);this.log('Gewonnen! '+money+' ₽ erhalten.');}
    if(b.gym!==null&&!this.s.badges.includes(b.gym)){this.s.badges.push(b.gym);this.log(this.d.gyms[b.gym].badge+' erhalten!');}this.log('Kampf beendet.');return;
   }b.stages[1]=Array(7).fill(0);b.volatile[1]={};e=b.enemies[b.enemy];this.mark(this.s.seen,e.species);this.log(b.title+' schickt '+this.name(e)+'!');this.entryAbility(1);
  }
  if(p.hp<=0){this.log(this.name(p)+' ist besiegt.');if(!this.s.party.some(m=>m.hp>0)){b.result='loss';this.s.money=Math.floor(this.s.money*.9);this.heal();this.log('Dein Team wurde im Pokécenter versorgt.');}}
 }
 switch(index){const b=this.battle;if(!b||b.result)throw Error('Kein aktiver Kampf.');const next=this.s.party[index];if(!next||next.hp<=0||index===b.active)throw Error('Dieses Pokémon kann nicht eingewechselt werden.');const forced=this.mons()[0].hp<=0;let old=this.mons()[0];if(old.ability===30)old.status='';b.active=index;b.stages[0]=Array(7).fill(0);b.volatile[0]={};this.mark(b.participants,next.id);this.log('Los, '+this.name(next)+'!');this.entryAbility(0);if(!forced)this.attack(1,this.enemyMove());this.endTurn();}
 useInBattle(id,index,moveSlot=0){const b=this.battle;if(!b||b.result)throw Error('Kein Kampf.');if(this.mons()[0].hp<=0)throw Error('Zuerst Pokémon wechseln.');this.item(id,index,moveSlot).forEach(t=>this.log(t));this.attack(1,this.enemyMove());this.endTurn();}
 ballMultiplier(id,enemy){let types=this.species(enemy).types;return id===2?2:id===3||id===5||id===499?1.5:id===8?Math.max(1,(41-enemy.level)/10):id===13&&this.battle.dark?3.5:id===492&&this.species(enemy).stats[3]>=100?4:id===493?(this.mons()[0].level>=enemy.level*4?8:this.mons()[0].level>=enemy.level*2?4:this.mons()[0].level>enemy.level?2:1):id===6&&(types.includes(6)||types.includes(11))?3:id===9&&this.s.caught.includes(enemy.species)?3:id===10?Math.min(4,1+this.battle.turn*.1):id===15&&this.battle.turn===0?4:1;}
 catchChance(m,id){const max=this.stats(m)[0];let a=((3*max-2*m.hp)*this.species(m).catch*this.ballMultiplier(id,m))/(3*max);if(m.status)a*=m.status==='sleep'||m.status==='freeze'?2:1.5;return {a:Math.floor(a),b:a>0?Math.min(65536,Math.floor(1048560/Math.sqrt(Math.sqrt(16711680/a)))):0};}
 catch(id){const b=this.battle;if(!b||b.result)throw Error('Kein Kampf.');if(b.trainer!==null)throw Error('Trainer-Pokémon können nicht gefangen werden.');if(!this.room())throw Error('Team und Boxen sind voll.');if(!this.quantity(id))throw Error('Kein Ball vorhanden.');if(!(id>=1&&id<=16||/ball$/i.test(this.itemName(id))))throw Error('Kein Pokéball.');this.s.bag[id]--;const enemy=this.mons()[1],rate=this.catchChance(enemy,id);b.turn++;let caught=id===1||rate.a>=255;
  if(!caught){caught=true;for(let i=0;i<4;i++)if(this.int(0,65535)>=rate.b){caught=false;break;}}
  if(caught){if(id===14){enemy.hp=this.stats(enemy)[0];enemy.status='';enemy.moves.forEach(p=>p.pp=this.maxPP(p));}if(id===497)enemy.friendship=200;const where=this.add(enemy);b.result='caught';this.log(this.name(enemy)+' wurde gefangen und ins '+where+' geschickt!');}
  else{this.log(this.name(enemy)+' ist ausgebrochen!');this.attack(1,this.enemyMove());this.endTurn();}this.save();return caught;
 }
 escape(){const b=this.battle;if(b.trainer!==null)throw Error('Aus Trainerkämpfen kannst du nicht fliehen.');if(this.rand()<.75){b.result='escape';this.log('Du bist entkommen.');}else{this.log('Flucht fehlgeschlagen.');this.attack(1,this.enemyMove());this.endTurn();}this.save();}
}
return {Game,TYPES,statusLabel,clamp};
});
