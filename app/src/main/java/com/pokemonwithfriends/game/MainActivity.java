package com.pokemonwithfriends.game;
import android.app.Activity;
import android.os.Bundle;
import android.view.*;
import android.graphics.*;
import android.app.AlertDialog;
import android.widget.EditText;
import android.text.InputFilter;
import android.util.Base64;
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
  Bitmap[] portraits=new Bitmap[2];
  int avatar=0,outfit=0,px=10,py=10;
  String playerName="GOLD";
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
  Game(){super(MainActivity.this);
   try {String[] names={"boy.png.base64","girl.png.base64"};for(int i=0;i<2;i++){
    java.io.InputStream stream=getAssets().open(names[i]);
    java.io.ByteArrayOutputStream buf=new java.io.ByteArrayOutputStream();byte[] tmp=new byte[4096];int n;
    while((n=stream.read(tmp))!=-1)buf.write(tmp,0,n);stream.close();
    byte[] bytes=Base64.decode(buf.toByteArray(),Base64.DEFAULT);
    portraits[i]=BitmapFactory.decodeByteArray(bytes,0,bytes.length);
   }}catch(Exception e){android.util.Log.e("PWF","Portraits not loaded",e);}
  }
  void box(Canvas c,float x,float y,float w,float h,int clr){p.setColor(clr);c.drawRect(x,y,x+w,y+h,p);}
  void text(Canvas c,String s,int x,int y,int size){p.setTypeface(Typeface.DEFAULT_BOLD);p.setTextSize(size);p.setTextAlign(Paint.Align.CENTER);p.setColor(Color.WHITE);c.drawText(s,x,y,p);}
  void button(Canvas c,int x,int y,int w,int h,String name){box(c,x,y,w,h,0xff3866ad);text(c,name,x+w/2,y+h/2+7,18);}
  void person(Canvas c,float x,float y,int scale){
   box(c,x-6*scale,y+4*scale,5*scale,10*scale,0xff283d60);box(c,x+scale,y+4*scale,5*scale,10*scale,0xff283d60);
   box(c,x-8*scale,y-7*scale,16*scale,14*scale,avatar==0?0xffd84040:0xffd85b88);
   box(c,x-7*scale,y-21*scale,14*scale,15*scale,0xffefc29f);
   box(c,x-9*scale,y-24*scale,18*scale,6*scale,avatar==0?0xffdc2929:0xffef7197);
  }
  @Override public void onDraw(Canvas c){
   c.save();c.scale(getWidth()/960f,getHeight()/540f);
   box(c,0,0,960,540,0xff1b283b);
   if(!playing){
    text(c,"POKEMON WITH FRIENDS",480,80,36);
    text(c,"WAeHLE DEINE FIGUR",480,118,26);
    box(c,275,143,190,235,avatar==0?0xffe85b5b:0xffd0a349);
    box(c,495,143,190,235,avatar==1?0xffe85b5b:0xffd0a349);
    box(c,282,150,176,221,0xffe3ac55);
    box(c,502,150,176,221,0xffe3ac55);
    p.setFilterBitmap(false);
    if(portraits[0]!=null)c.drawBitmap(portraits[0],null,new Rect(312,161,430,350),p);
    else person(c,370,310,4);
    if(portraits[1]!=null)c.drawBitmap(portraits[1],null,new Rect(532,161,650,350),p);
    else person(c,590,310,4);
    text(c,"JUNGE",370,370,20);text(c,"MAeDCHEN",590,370,20);
    text(c,"NAME: "+playerName,480,423,20);
    button(c,310,444,155,55,"NAME");button(c,505,444,155,55,"START");
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
    if(hit(x,y,275,143,190,235))avatar=0;
    if(hit(x,y,495,143,190,235))avatar=1;
    if(hit(x,y,310,444,155,55)){
     EditText field=new EditText(MainActivity.this);
     field.setSingleLine(true);
     field.setText(playerName);
     field.setFilters(new InputFilter[]{new InputFilter.LengthFilter(10)});
     new AlertDialog.Builder(MainActivity.this).setTitle("Dein Name").setView(field)
      .setPositiveButton("OK",(dialog,which)->{String value=field.getText().toString().trim();if(!value.isEmpty())playerName=value;invalidate();})
      .setNegativeButton("Abbrechen",null).show();
    }
    if(hit(x,y,505,444,155,55))playing=true;
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
