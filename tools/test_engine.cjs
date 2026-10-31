const {test}=require('node:test'),assert=require('node:assert/strict');
const {Game}=require('../app/src/main/assets/game/engine.js');
function fixture(){
 const d={species:[null],moves:[],items:[],growth:[Array.from({length:101},(_,n)=>n**3)],typeChart:[[10,12,2],[11,10,2],[0,7,0],[12,11,2],[12,10,.5]],encounters:[{levels:Array(12).fill(3),day:Array(12).fill(1),night:Array(12).fill(2),morning:Array(12).fill(1),surf:Array(5).fill([5,8,2])}],trainers:[],gyms:[{badge:'Testorden'}]};
 for(const [id,types]of [[1,[12,3]],[2,[10,10]],[3,[11,11]],[4,[7,7]]])d.species[id]={id,name:'Test '+id,stats:[45,49,49,45,65,65],types,catch:255,yieldExp:60,evs:[0,0,0,0,1,0],growth:0,abilities:[0,0],learn:[[1,1],[3,2],[6,3]],evolutions:[],tm:[]};
 for(const id of [1,2,3,165])d.moves[id]={id,name:'Attacke '+id,effect:'HIT',category:0,power:35,type:0,accuracy:100,pp:20,chance:0,priority:0};
 d.items[4]={id:4,name:'Pokéball',price:200};d.items[1]={id:1,name:'Meisterball',price:0};d.items[18]={id:18,name:'Gegengift',price:100};d.items[17]={id:17,name:'Trank',price:300,flags:[0,0,0,0,0,4],heal:20};d.trainers[1]={id:1,name:'Testtrainer',party:[{species:1,level:3,moves:[1],item:0}]};return d;
}
function game(){const g=new Game(fixture());g.s.seed=123;g.starter(2);return g;}
test('HP and non-HP stats follow level/IV/EV formula',()=>{let g=game(),m=g.s.party[0];m.iv.fill(0);m.ev.fill(0);m.nature=0;assert.equal(g.stats(m)[0],19);assert.equal(g.stats(m)[1],9);});
test('dual types multiply without repeating a monotype',()=>{let g=game(),m=g.create(2);assert.equal(g.effectiveness(11,m),2);m.species=1;assert.equal(g.effectiveness(10,m),2);});
test('type immunity causes zero damage',()=>{let g=game();g.startWild(4,5);const out=g.damage(g.mons()[0],g.mons()[1],g.d.moves[1],0);assert.equal(out.damage,0);});
test('buy and sell preserve quantities and money',()=>{let g=game();g.buy(4,3);assert.equal(g.s.money,2400);assert.equal(g.quantity(4),23);g.sell(4,2);assert.equal(g.s.money,2600);assert.equal(g.quantity(4),21);});
test('reject negative purchases and insufficient balances',()=>{let g=game();assert.throws(()=>g.buy(4,-1));assert.throws(()=>g.buy(4,99));assert.equal(g.s.money,3000);});
test('healing consumes one item only on effect',()=>{let g=game(),m=g.s.party[0];assert.throws(()=>g.item(17));assert.equal(g.quantity(17),5);m.hp=1;g.item(17);assert.equal(m.hp,g.stats(m)[0]);assert.equal(g.quantity(17),4);});
test('captures go to the next box when six party slots are occupied',()=>{let g=game();while(g.s.party.length<6)g.s.party.push(g.create(1));g.s.bag[1]=1;g.startWild(3,5);assert.equal(g.catch(1),true);assert.equal(g.s.party.length,6);assert.equal(g.s.boxes[0][0].species,3);assert.equal(g.quantity(1),0);assert.equal(g.battle.result,'caught');});
test('full storage rejects capture without consuming a ball',()=>{let g=game();while(g.s.party.length<6)g.s.party.push(g.create(1));for(let b of g.s.boxes)for(let i=0;i<30;i++)b[i]=g.create(1);g.s.bag[1]=1;g.startWild(2,5);assert.throws(()=>g.catch(1));assert.equal(g.quantity(1),1);});
test('trainer Pokémon cannot be caught',()=>{let g=game();g.s.bag[1]=1;g.startTrainer(1);assert.throws(()=>g.catch(1));assert.equal(g.quantity(1),1);});
test('successful capture cannot be repeated',()=>{let g=game();g.s.bag[1]=2;g.startWild(1,5);g.catch(1);assert.throws(()=>g.catch(1));assert.equal(g.s.party.length,2);assert.equal(g.quantity(1),1);});
test('deposit and withdraw never duplicate a monster',()=>{let g=game();g.add(g.create(1));let id=g.s.party[1].id;g.deposit(1,3);assert.equal(g.s.boxes[3][0].id,id);assert.equal(g.s.party.length,1);g.withdraw(3,0);assert.equal(g.s.party[1].id,id);assert.equal(g.s.boxes[3][0],null);});
test('last conscious party member cannot be deposited',()=>{let g=game();g.add(g.create(1));g.s.party[1].hp=0;assert.throws(()=>g.deposit(0,0));assert.throws(()=>g.deposit(9,0));});
test('save round trip and duplicate identity rejection',()=>{let g=game();g.add(g.create(1));const s=JSON.parse(JSON.stringify(g.s));assert.deepEqual(new Game(g.d,s).s,s);s.party[1].id=s.party[0].id;assert.throws(()=>new Game(g.d,s));});
test('corrupt negative inventory and HP rejected',()=>{let g=game(),s=JSON.parse(JSON.stringify(g.s));s.bag[4]=-1;assert.throws(()=>new Game(g.d,s));s=JSON.parse(JSON.stringify(g.s));s.party[0].hp=9999;assert.throws(()=>new Game(g.d,s));});
test('experience levels up and learns moves',()=>{let g=game(),m=g.s.party[0],log=[];g.gain(m,6**3-m.exp,log);assert.equal(m.level,6);assert.ok(m.moves.some(x=>x.id===3));assert.ok(log.length);});
test('ordinary attacks consume PP',()=>{let g=game();g.startWild(1,10);const before=g.mons()[0].moves[0].pp;g.turn(0);assert.equal(g.s.party[0].moves[0].pp,before-1);});
test('zero PP move is rejected if another move remains',()=>{let g=game();g.startWild(1,10);g.mons()[0].moves[0].pp=0;assert.throws(()=>g.turn(0));});
test('all PP exhausted still permits Struggle',()=>{let g=game();g.startWild(1,10);g.mons()[0].moves.forEach(p=>p.pp=0);assert.doesNotThrow(()=>g.turn(0));});
test('gym badge is awarded only after victory',()=>{let g=game();g.startTrainer(1,0);assert.equal(g.s.badges.length,0);g.mons()[1].hp=0;g.checkEnd();assert.deepEqual(g.s.badges,[0]);assert.equal(g.battle.result,'win');});
test('healing restores HP PP and status',()=>{let g=game(),m=g.s.party[0];m.hp=0;m.status='poison';m.moves[0].pp=0;g.heal();assert.equal(m.hp,g.stats(m)[0]);assert.equal(m.moves[0].pp,g.maxPP(m.moves[0]));assert.equal(m.status,'');});
test('a defeated active monster must switch before acting',()=>{let g=game();g.add(g.create(1));g.startWild(1,10);g.mons()[0].hp=0;assert.throws(()=>g.turn(0));g.switch(1);assert.equal(g.battle.active,1);});
test('Quick Ball keeps its first-turn multiplier',()=>{let g=game();g.s.bag[15]=1;g.startWild(1,5);let multiplier;g.catchChance=function(m,id){multiplier=this.ballMultiplier(id,m);return {a:255,b:65536};};g.catch(15);assert.equal(multiplier,4);});
test('HM teaching does not consume the HM',()=>{let g=game();g.d.items[420]={id:420,name:'VM01',price:0};g.d.tmMoves=Array(100).fill(0);g.d.tmMoves[92]=3;g.d.species[2].tm=[92];g.s.bag[420]=1;g.item(420);assert.equal(g.quantity(420),1);assert.ok(g.s.party[0].moves.some(p=>p.id===3));});
test('trade-item evolution still requires and consumes the held item',()=>{let g=game();g.d.species[2].evolutions=[[6,221,3]];g.s.bag[9000]=1;assert.throws(()=>g.item(9000));g.s.party[0].item=221;g.item(9000);assert.equal(g.s.party[0].species,3);assert.equal(g.s.party[0].item,0);});
test('Protect expires at the end of a turn',()=>{let g=game();g.startWild(1,5);g.battle.volatile[0].protect=true;g.endTurn();assert.equal(g.battle.volatile[0].protect,false);});
