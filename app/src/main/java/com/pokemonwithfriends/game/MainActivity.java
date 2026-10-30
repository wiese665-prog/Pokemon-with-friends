package com.pokemonwithfriends.game;

import android.app.*;
import android.content.*;
import android.graphics.*;
import android.net.Uri;
import android.os.*;
import android.text.InputFilter;
import android.view.*;
import android.widget.EditText;
import java.io.*;
import java.util.HashSet;

public class MainActivity extends Activity {
    private static final int PICK_PACK=7;
    private Game game;
    private TownPack pack;
    private volatile boolean loading;
    private String loadError="";
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        getWindow().getDecorView().setSystemUiVisibility(5894|1024|512);
        game=new Game(); setContentView(game);
        File installed=new File(getFilesDir(),"town.pwf.zip");
        if(installed.exists()) loadPack(null,installed);
        else {
            try { getAssets().open("town.pwf.zip").close(); loadPack(null,null); }
            catch(IOException ignored) { /* Public builds import the private pack once. */ }
        }
    }
    private void choosePack() {
        if(loading)return;
        Intent intent=new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);intent.setType("*/*");
        startActivityForResult(intent,PICK_PACK);
    }
    @Override protected void onActivityResult(int request,int result,Intent data) {
        super.onActivityResult(request,result,data);
        if(request==PICK_PACK && result==RESULT_OK && data!=null && data.getData()!=null)loadPack(data.getData(),null);
    }
    private void loadPack(Uri uri,File existing) {
        loading=true;loadError="";game.clearInput();game.invalidate();
        new Thread(()->{
            File temp=new File(getFilesDir(),"town-import.tmp");
            try {
                TownPack next;
                if(uri!=null) {
                    try(InputStream in=getContentResolver().openInputStream(uri);OutputStream out=new FileOutputStream(temp)) {
                        if(in==null)throw new IOException("Datei kann nicht geöffnet werden");
                        byte[] buffer=new byte[8192];int n,total=0;
                        while((n=in.read(buffer))!=-1) {
                            total+=n;if(total>TownPack.MAX_PACK_BYTES)throw new IOException("Paket ist zu groß");out.write(buffer,0,n);
                        }
                    }
                    next=new TownPack(new FileInputStream(temp));
                    if(!temp.renameTo(new File(getFilesDir(),"town.pwf.zip")))throw new IOException("Paket kann nicht gespeichert werden");
                } else next=new TownPack(existing!=null?new FileInputStream(existing):getAssets().open("town.pwf.zip"));
                runOnUiThread(()->{pack=next;loading=false;game.onPackLoaded();});
            } catch(Exception error) {
                temp.delete();
                runOnUiThread(()->{loading=false;loadError=error.getMessage()==null?"Import fehlgeschlagen":error.getMessage();game.invalidate();
                    new AlertDialog.Builder(this).setTitle("Import fehlgeschlagen").setMessage(loadError+"\nBitte das vorbereitete .pwf.zip-Paket auswählen.").setPositiveButton("OK",null).show();});
            }
        },"HeartGold-import").start();
    }
    @Override public boolean onKeyDown(int key,KeyEvent event) {
        if(game.key(key,true))return true;return super.onKeyDown(key,event);
    }
    @Override public boolean onKeyUp(int key,KeyEvent event) {
        if(game.key(key,false))return true;return super.onKeyUp(key,event);
    }
    @Override public void onBackPressed() {
        if(game.playing){game.playing=false;game.clearInput();game.invalidate();}else super.onBackPressed();
    }
    @Override protected void onPause(){super.onPause();game.pause();}
    @Override protected void onResume(){super.onResume();game.resume();}
    @Override public void onWindowFocusChanged(boolean focus){super.onWindowFocusChanged(focus);if(!focus&&game!=null)game.clearInput();}

    final class Game extends View {
        final Paint paint=new Paint(Paint.ANTI_ALIAS_FLAG);
        final Handler handler=new Handler(Looper.getMainLooper());
        final HashSet<Integer> pressed=new HashSet<>();
        final Bitmap playerImage=Bitmap.createBitmap(64,64,Bitmap.Config.ARGB_8888);
        final int[] masked=new int[4096],framePixels=new int[1024];
        boolean playing=false,hasSpawned=false,active=false;
        int avatar=0,direction=0,step=0,px=23,py=13,touchDir=-1;
        float drawX=23,drawY=13,fromX=23,fromY=13;
        long stepStart=0;boolean moving=false;
        String playerName;
        float viewScale=1,viewLeft=0,viewTop=0;
        Game(){super(MainActivity.this);setFocusableInTouchMode(true);playerName=getPreferences(0).getString("name","GOLD");avatar=getPreferences(0).getInt("avatar",0);}
        void onPackLoaded(){avatar=Math.max(0,Math.min(avatar,pack.sheets.length-1));playing=false;hasSpawned=false;clearInput();invalidate();}
        void resume(){if(!active){active=true;handler.post(tick);}}
        void pause(){active=false;handler.removeCallbacks(tick);clearInput();getPreferences(0).edit().putString("name",playerName).putInt("avatar",avatar).apply();}
        void clearInput(){pressed.clear();touchDir=-1;}
        final Runnable tick=new Runnable(){public void run(){
            if(!active)return;
            long now=SystemClock.uptimeMillis();
            if(playing&&pack!=null&&!loading){
                if(moving){float t=Math.min(1,(now-stepStart)/150f);drawX=fromX+(px-fromX)*t;drawY=fromY+(py-fromY)*t;if(t>=1)moving=false;}
                int dir=inputDirection();
                if(!moving&&dir>=0){direction=dir;int dx=dir==2?-1:dir==3?1:0;int dy=dir==1?-1:dir==0?1:0;
                    if(pack.walkable(px+dx,py+dy)){fromX=px;fromY=py;px+=dx;py+=dy;stepStart=now;moving=true;step=(step+1)%2;}
                }
                invalidate();
            }
            handler.postDelayed(this,16);
        }};
        int keyDir(int key){
            if(key==KeyEvent.KEYCODE_S||key==KeyEvent.KEYCODE_DPAD_DOWN)return 0;
            if(key==KeyEvent.KEYCODE_W||key==KeyEvent.KEYCODE_DPAD_UP)return 1;
            if(key==KeyEvent.KEYCODE_A||key==KeyEvent.KEYCODE_DPAD_LEFT)return 2;
            if(key==KeyEvent.KEYCODE_D||key==KeyEvent.KEYCODE_DPAD_RIGHT)return 3;return -1;
        }
        boolean key(int key,boolean down){if(!playing)return false;int dir=keyDir(key);if(dir<0)return false;if(down)pressed.add(key);else pressed.remove(key);return true;}
        int inputDirection(){if(touchDir>=0)return touchDir;for(int key:new int[]{KeyEvent.KEYCODE_W,KeyEvent.KEYCODE_DPAD_UP,KeyEvent.KEYCODE_S,KeyEvent.KEYCODE_DPAD_DOWN,KeyEvent.KEYCODE_A,KeyEvent.KEYCODE_DPAD_LEFT,KeyEvent.KEYCODE_D,KeyEvent.KEYCODE_DPAD_RIGHT})if(pressed.contains(key))return keyDir(key);return -1;}
        void start(){
            if(pack==null||loading)return;
            if(!hasSpawned){px=pack.spawnX;py=pack.spawnY;drawX=fromX=px;drawY=fromY=py;moving=false;hasSpawned=true;direction=0;}
            clearInput();playing=true;getPreferences(0).edit().putString("name",playerName).putInt("avatar",avatar).apply();invalidate();
        }
        void rect(Canvas c,float x,float y,float w,float h,int color,float radius){paint.setColor(color);c.drawRoundRect(x,y,x+w,y+h,radius,radius,paint);}
        void text(Canvas c,String value,float x,float y,float size,int color,boolean bold){paint.setColor(color);paint.setTextSize(size);paint.setTypeface(bold?Typeface.DEFAULT_BOLD:Typeface.DEFAULT);paint.setTextAlign(Paint.Align.LEFT);c.drawText(value,x,y,paint);}
        void button(Canvas c,float x,float y,float w,float h,String label,int color){rect(c,x,y,w,h,color,12);paint.setTypeface(Typeface.DEFAULT_BOLD);paint.setTextSize(16);paint.setTextAlign(Paint.Align.CENTER);paint.setColor(Color.WHITE);c.drawText(label,x+w/2,y+h/2+6,paint);}
        void sprite(Canvas c,int avatar,int frame,int dir,float x,float y,float size){paint.setFilterBitmap(false);c.drawBitmap(pack.sheets[avatar],new Rect(frame*32,dir*32,frame*32+32,dir*32+32),new RectF(x,y,x+size,y+size),paint);}
        @Override protected void onDraw(Canvas c){
            super.onDraw(c);viewScale=Math.min(getWidth()/960f,getHeight()/540f);viewLeft=(getWidth()-960*viewScale)/2;viewTop=(getHeight()-540*viewScale)/2;
            c.drawColor(0xff101c1c);c.save();c.translate(viewLeft,viewTop);c.scale(viewScale,viewScale);c.clipRect(0,0,960,540);
            if(playing&&pack!=null)drawWorld(c);else drawSelection(c);
            if(loading){rect(c,0,0,960,540,0xdd102421,0);text(c,"Neuborkia wird geladen …",290,280,25,Color.WHITE,true);}
            c.restore();
        }
        void drawSelection(Canvas c){
            rect(c,0,0,960,540,0xff102823,0);
            text(c,"POKÉMON WITH FRIENDS",38,45,17,0xff8db8a1,true);
            text(c,"Dein Abenteuer in Neuborkia",38,88,32,0xfff3f2df,true);
            text(c,"Wähle deinen Trainer und erkunde die HeartGold-Karte.",39,117,16,0xffb3c8bd,false);
            if(pack==null){
                rect(c,38,150,884,270,0xff1c3931,18);
                text(c,"HEARTGOLD · DEUTSCHE EDITION",68,192,14,0xffb9d581,true);
                text(c,"Neuborkia wartet auf dich.",68,240,29,Color.WHITE,true);
                text(c,"Importiere das vorbereitete HeartGold-Neuborkia.pwf.zip-Paket.",68,280,18,0xffd3e1d8,false);
                text(c,"Danach stehen Karte und acht laufende Trainer offline bereit.",68,310,18,0xffd3e1d8,false);
                button(c,68,344,310,50,"HEARTGOLD-PAKET IMPORTIEREN",0xff477758);
                text(c,"Die .nds-Datei wird mit tools/import_heartgold.py umgewandelt.",39,461,15,0xff9bb5a5,false);
                return;
            }
            for(int i=0;i<pack.sheets.length;i++){
                int col=i%4,row=i/4;float x=38+col*154,y=144+row*158;
                rect(c,x,y,142,146,i==avatar?0xffb5ce78:0xff2c4940,14);
                rect(c,x+3,y+3,136,140,i==avatar?0xff395d44:0xff1c3931,12);
                sprite(c,i,0,0,x+35,y+8,72);
                text(c,pack.names[i],x+13,y+108,18,Color.WHITE,true);
                text(c,pack.roles[i],x+13,y+130,12,0xffadc7b5,false);
            }
            rect(c,678,144,244,304,0xff223e34,18);
            text(c,"DEIN TRAINER",702,177,12,0xffb7cd8f,true);
            sprite(c,avatar,0,0,716,186,160);
            text(c,pack.names[avatar],702,367,25,Color.WHITE,true);
            text(c,"Name: "+playerName,702,396,16,0xffcedbce,false);
            button(c,700,411,200,26,"NAMEN ÄNDERN",0xff3c5d4c);
            text(c,"8 Trainer · Neuborkia · offline",39,488,14,0xffa7c1ae,false);
            button(c,38,504,220,28,"PAKET WECHSELN",0xff314e40);
            button(c,678,465,244,55,hasSpawned?"WEITER ERKUNDEN  ›":"IN NEUBORKIA STARTEN  ›",0xff5c8050);
        }
        void drawWorld(Canvas c){
            float worldX=drawX*16-248,worldZ=drawY*16-248;
            float imageX=pack.originX+worldX*2,imageY=pack.originY+(.8f*worldZ-.6f*16)*2;
            float offsetX=480-imageX,offsetY=280-imageY;
            c.save();c.translate(offsetX,offsetY);paint.setFilterBitmap(false);c.drawBitmap(pack.background,0,0,paint);
            int frame=moving?((SystemClock.uptimeMillis()-stepStart)<75?1:(step==0?2:3)):0;
            drawMaskedPlayer(c,imageX,imageY,.6f*worldZ+.8f*16,frame);
            c.restore();
            rect(c,24,18,284,68,0xe8102823,14);text(c,"NEUBORKIA",42,46,21,0xfff5f3df,true);text(c,playerName+"  ·  "+pack.names[avatar],42,69,14,0xffb9d098,false);
            button(c,790,22,146,44,"TRAINER",0xdd294e3c);
            button(c,83,350,60,52,"▲",touchDir==1?0xff789b5f:0xcc183b30);
            button(c,20,407,60,52,"◀",touchDir==2?0xff789b5f:0xcc183b30);
            button(c,146,407,60,52,"▶",touchDir==3?0xff789b5f:0xcc183b30);
            button(c,83,464,60,52,"▼",touchDir==0?0xff789b5f:0xcc183b30);
            rect(c,651,481,285,37,0xdd102823,10);text(c,"WASD / Pfeiltasten · Halten zum Laufen",665,505,13,0xffcfddc6,false);
        }
        void drawMaskedPlayer(Canvas c,float fx,float fy,float depth,int frame){
            pack.sheets[avatar].getPixels(framePixels,0,32,frame*32,direction*32,32,32);
            int left=Math.round(fx-32),top=Math.round(fy-56);
            for(int y=0;y<64;y++)for(int x=0;x<64;x++){
                int color=framePixels[(y/2)*32+x/2],mx=left+x,my=top+y;
                if(mx>=0&&my>=0&&mx<pack.width&&my<pack.height){
                    float scene=((pack.depth[my*pack.width+mx]&65535)-32768)/64f;
                    if(scene>depth+1.5f)color=Color.TRANSPARENT;
                }
                masked[y*64+x]=color;
            }
            playerImage.setPixels(masked,0,64,0,0,64,64);c.drawBitmap(playerImage,left,top,paint);
        }
        boolean hit(float x,float y,int bx,int by,int w,int h){return x>=bx&&x<bx+w&&y>=by&&y<by+h;}
        int touchDirection(float x,float y){if(hit(x,y,83,350,60,52))return 1;if(hit(x,y,20,407,60,52))return 2;if(hit(x,y,146,407,60,52))return 3;if(hit(x,y,83,464,60,52))return 0;return -1;}
        @Override public boolean onTouchEvent(MotionEvent event){
            if(viewScale<=0)return true;
            float x=(event.getX()-viewLeft)/viewScale,y=(event.getY()-viewTop)/viewScale;
            int action=event.getActionMasked();
            if(action==MotionEvent.ACTION_UP||action==MotionEvent.ACTION_CANCEL){touchDir=-1;invalidate();return true;}
            if(loading)return true;
            if(playing){
                touchDir=touchDirection(x,y);
                if(action==MotionEvent.ACTION_DOWN&&hit(x,y,790,22,146,44)){playing=false;clearInput();}
            }else if(action==MotionEvent.ACTION_DOWN){
                if(pack==null){if(hit(x,y,68,344,310,50))choosePack();}
                else {
                    for(int i=0;i<pack.sheets.length;i++)if(hit(x,y,38+(i%4)*154,144+(i/4)*158,142,146))avatar=i;
                    if(hit(x,y,678,465,244,55))start();
                    if(hit(x,y,38,504,220,28))choosePack();
                    if(hit(x,y,700,411,200,26))editName();
                }
            }
            invalidate();return true;
        }
        void editName(){
            EditText field=new EditText(MainActivity.this);field.setSingleLine(true);field.setText(playerName);field.setFilters(new InputFilter[]{new InputFilter.LengthFilter(10)});
            new AlertDialog.Builder(MainActivity.this).setTitle("Dein Trainername").setView(field).setPositiveButton("Speichern",(dialog,which)->{
                String value=field.getText().toString().trim();if(!value.isEmpty())playerName=value;invalidate();
            }).setNegativeButton("Abbrechen",null).show();
        }
    }
}
