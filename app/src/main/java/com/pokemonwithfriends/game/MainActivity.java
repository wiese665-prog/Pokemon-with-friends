package com.pokemonwithfriends.game;
import android.app.Activity;
import android.os.Bundle;
import android.view.*;
import android.graphics.*;
public class MainActivity extends Activity {
 Game game;
 @Override public void onCreate(Bundle b){super.onCreate(b);getWindow().getDecorView().setSystemUiVisibility(5894|1024|512);game=new Game();setContentView(game);}
 @Override public boolean onKeyDown(int k,KeyEvent e){
  if(game.playing){
   if(k==19||k==KeyEvent.KEYCODE_W){game.move(0,-1);return true;}
   if(k==20||k==KeyEvent.KEYCODE_S){game.move(0,1);return true;}
   if(k==21||k==KeyEvent.KEYCODE_A){game.move(-1,0);return true;}
   if(k==22||k==KeyEvent.KEYCODE_D){game.move(1,0);return true;}
  }
  return super.onKeyDown(k,e);
 }
 class Game extends View {
  Paint p=new Paint(3);boolean playing=false;
  int avatar=0,outfit=0,px=10,py=10;
  int[] colors={0xff4f78d8,0xffe85a73,0xff49a989,0xffba79df};
  String[] map={
   "TTTTTTTTTTTTTTTTTTTT",
   "TTTGGGGGGGGGGGGGGTTT",
   "TTGGGGGGGGGGGGGGGGTT",
   "TGGGGGHHHGGGGHHHGGGT",
   "TGGGGGHHHGGGGHHHGGGT",
   "TGGGGGHHHGGGGHHHGGGT",
   "TGGGGGGPGGGGGGPGGGGT",
   "TGGGGGGPPPPPPPPGGGGT",
   "TGGGGGGPPPPPPPPGGGGT",
   "TGGGGGGPGGGGGGPGGGGT",
   "TGGGGGGPGGGGGGPGGGGT",
   "TGGHHHGPGGGGGGPGGGGT",
   "TGGHHHGPGGGGGGPGGGGT",
   "TGGHHHGGGGGGGGGGGGGT",
   "TTGGGGGGGGGGGGGGGGTT",
   "TTTTTTTTTTTTTTTTTTTT"};
  Game(){super(MainActivity.this);}
  void box(Canvas c,float x,float y,float w,float h,int clr){p.setColor(clr);c.drawRect(x,y,x+w,y+h,p);}
  void text(Canvas c,String s,int x,int y,int size){p.setTypeface(Typeface.DEFAULT_BOLD);p.setTextSize(size);p.setTextAlign(Paint.Align.CENTER);p.setColor(Color.WHITE);c.drawText(s,x,y,p);}
  void button(Canvas c,int x,int y,int w,int h,String name){box(c,x,y,w,h,0xff3866ad);text(c,name,x+w/2,y+h/2+7,18);}
  void person(Canvas c,float x,float y,int scale){
   box(c,x-6*scale,y+4*scale,5*scale,10*scale,0xff283d60);box(c,x+scale,y+4*scale,5*scale,10*scale,0xff283d60);
   box(c,x-8*scale,y-7*scale,16*scale,14*scale,colors[outfit]);
   box(c,x-7*scale,y-21*scale,14*scale,15*scale,avatar==0?0xffefc29f:0xffbd845c);
   box(c,x-9*scale,y-24*scale,18*scale,6*scale,0xff513d34);
  }
  @Override public void onDraw(Canvas c){
   c.save();c.scale(getWidth()/960f,getHeight()/540f);
   box(c,0,0,960,540,0xff1b283b);
   if(!playing){
    text(c,"POKEMON WITH FRIENDS",480,80,36);
    text(c,"CHARAKTER ERSTELLEN",480,125,22);
    box(c,335,145,290,205,0xff7dbe8f);person(c,480,275,5);
    button(c,270,385,135,55,"FIGUR");button(c,425,385,135,55,"FARBE");
    button(c,580,385,135,55,"START");
   }else{
    c.save();c.translate(160,12);c.scale(.8f,.8f);
    for(int y=0;y<16;y++)for(int x=0;x<20;x++){
     char t=map[y].charAt(x);int xx=x*32,yy=y*32;
     box(c,xx,yy,32,32,t=='T'?0xff39734b:t=='P'?0xffd4caab:t=='H'?0xffd9bd86:0xff8cc76c);
     if(t=='T'){p.setColor(0xff21663a);c.drawCircle(xx+16,yy+15,14,p);}
     if(t=='H'){box(c,xx,yy,32,10,0xffbe625c);box(c,xx+9,yy+17,14,12,0xff688397);}
    }
    person(c,px*32+16,py*32+16,2);c.restore();
    text(c,"NEUBORKIA – PROTOTYP",500,44,22);
    button(c,85,397,52,38,"▲");button(c,25,438,52,38,"◀");
    button(c,145,438,52,38,"▶");button(c,85,480,52,38,"▼");
    text(c,"WASD / PFEILTASTEN",800,505,17);
   }
   c.restore();
  }
  void move(int dx,int dy){int nx=px+dx,ny=py+dy;
   if(nx>=0&&ny>=0&&ny<map.length&&nx<map[ny].length()&&map[ny].charAt(nx)!='H'&&map[ny].charAt(nx)!='T'){px=nx;py=ny;}invalidate();}
  boolean hit(float x,float y,int bx,int by,int w,int h){return x>=bx&&x<=bx+w&&y>=by&&y<=by+h;}
  @Override public boolean onTouchEvent(MotionEvent e){
   if(e.getAction()!=MotionEvent.ACTION_DOWN)return true;
   float x=e.getX()*960/getWidth(),y=e.getY()*540/getHeight();
   if(!playing){
    if(hit(x,y,270,385,135,55))avatar=1-avatar;
    if(hit(x,y,425,385,135,55))outfit=(outfit+1)%colors.length;
    if(hit(x,y,580,385,135,55))playing=true;
   }else{
    if(hit(x,y,85,397,52,38))move(0,-1);
    if(hit(x,y,25,438,52,38))move(-1,0);
    if(hit(x,y,145,438,52,38))move(1,0);
    if(hit(x,y,85,480,52,38))move(0,1);
   }
   invalidate();return true;
  }
 }
}
