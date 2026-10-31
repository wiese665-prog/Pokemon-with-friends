package com.pokemonwithfriends.game;

import android.app.*;
import android.content.*;
import android.net.Uri;
import android.os.Bundle;
import android.util.AtomicFile;
import android.webkit.*;
import org.json.JSONObject;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.zip.*;

/** Offline Android host. All requests are intercepted; the app has no network permission. */
public class MainActivity extends Activity {
    private WebView web;
    private volatile ZipFile pack;
    private volatile String packError="";
    private String exportText="";
    private static final int IMPORT_PACK=10,IMPORT_SAVE=11,EXPORT_SAVE=12;
    private static final long MAX_PACK=600L*1024*1024;
    @Override public void onCreate(Bundle state){
        super.onCreate(state);
        getWindow().addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        getWindow().getDecorView().setSystemUiVisibility(5894|1024|512);
        web=new WebView(this);
        WebSettings settings=web.getSettings();settings.setJavaScriptEnabled(true);settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);settings.setAllowContentAccess(false);settings.setBlockNetworkLoads(true);
        web.addJavascriptInterface(new Bridge(),"Android");
        web.setWebChromeClient(new WebChromeClient());
        web.setWebViewClient(new WebViewClient(){
            @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){return true;}
            @Override public WebResourceResponse shouldInterceptRequest(WebView view,WebResourceRequest request){return resource(request.getUrl());}
            @Override public void onPageFinished(WebView view,String url){if(pack!=null)view.evaluateJavascript("window.packReady&&window.packReady()",null);}
        });
        setContentView(web);web.loadUrl("https://pwf.local/index.html");
        new Thread(()->{
            try{
                File file=new File(getFilesDir(),"world-v3.pwf.zip");
                if(!file.exists()){
                    try(InputStream in=getAssets().open("world.pwf.zip")){copyPack(in,file);}
                    catch(FileNotFoundException missing){return;}
                }
                openPack(file);
            }catch(Exception error){packError=error.getMessage()==null?"Datenpaket konnte nicht geladen werden":error.getMessage();}
            runOnUiThread(()->web.evaluateJavascript("window.packReady&&window.packReady()",null));
        },"World-pack").start();
    }
    private WebResourceResponse resource(Uri uri){
        try{
            if(!"https".equals(uri.getScheme())||!"pwf.local".equals(uri.getHost()))return missing();
            String path=uri.getPath();if(path==null||path.contains("..")||path.contains("\\"))return missing();
            InputStream in;
            if(path.startsWith("/pack/")){
                ZipFile current=pack;if(current==null)return missing();ZipEntry entry=current.getEntry(path.substring(6));if(entry==null||entry.isDirectory())return missing();in=current.getInputStream(entry);
            }else{
                String name=path.equals("/")?"index.html":path.substring(1);
                if(!Arrays.asList("index.html","style.css","engine.js","game.js").contains(name))return missing();
                in=getAssets().open("game/"+name);
            }
            String mime=path.endsWith(".html")?"text/html":path.endsWith(".js")?"application/javascript":path.endsWith(".css")?"text/css":path.endsWith(".json")?"application/json":path.endsWith(".png")?"image/png":"application/octet-stream";
            Map<String,String> headers=new HashMap<>();headers.put("Cache-Control","no-store");headers.put("X-Content-Type-Options","nosniff");headers.put("Content-Security-Policy","default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'");
            return new WebResourceResponse(mime,mime.startsWith("text/")||mime.contains("json")||mime.contains("javascript")?"UTF-8":null,200,"OK",headers,in);
        }catch(Exception error){return missing();}
    }
    private WebResourceResponse missing(){return new WebResourceResponse("text/plain","UTF-8",404,"Not found",Collections.emptyMap(),new ByteArrayInputStream(new byte[0]));}
    private void validatePack(File file)throws Exception{
        try(ZipFile zip=new ZipFile(file)){
            if(zip.size()>6000)throw new IOException("Zu viele Paketdateien");
            Enumeration<? extends ZipEntry> entries=zip.entries();long total=0;
            while(entries.hasMoreElements()){
                ZipEntry e=entries.nextElement();String name=e.getName();
                if(name.startsWith("/")||name.contains("..")||name.contains("\\")||e.getSize()<0||e.getSize()>40L*1024*1024)throw new IOException("Ungültiges Datenpaket");
                total+=e.getSize();if(total>4L*1024*1024*1024)throw new IOException("Datenpaket zu groß");
            }
            ZipEntry entry=zip.getEntry("world.json");if(entry==null)throw new IOException("Bitte das Weltpaket Version 3 verwenden");
            String json=readText(zip.getInputStream(entry),30*1024*1024);
            JSONObject root=new JSONObject(json);
            if(!"pwf-heartgold-world".equals(root.getString("format"))||root.getInt("version")!=3||zip.getEntry("data.json")==null)throw new IOException("Unbekanntes Datenpaket");
        }
    }
    private synchronized void openPack(File file)throws Exception{validatePack(file);ZipFile next=new ZipFile(file);ZipFile old=pack;pack=next;if(old!=null)old.close();packError="";}
    private void copyPack(InputStream in,File destination)throws Exception{
        File temp=new File(getFilesDir(),"world-import.tmp");
        try(OutputStream out=new FileOutputStream(temp)){
            byte[] buf=new byte[65536];long total=0;int n;while((n=in.read(buf))!=-1){total+=n;if(total>MAX_PACK)throw new IOException("Paket zu groß");out.write(buf,0,n);}
        }catch(Exception error){temp.delete();throw error;}
        validatePack(temp);if(!temp.renameTo(destination)){temp.delete();throw new IOException("Paket kann nicht gespeichert werden");}
    }
    private String readText(InputStream input,int limit)throws IOException{
        try(InputStream in=input;ByteArrayOutputStream out=new ByteArrayOutputStream()){
            byte[] buf=new byte[8192];int n;while((n=in.read(buf))!=-1){if(out.size()+n>limit)throw new IOException("Datei zu groß");out.write(buf,0,n);}return out.toString("UTF-8");
        }
    }
    private void picker(int code){Intent i=new Intent(Intent.ACTION_OPEN_DOCUMENT);i.addCategory(Intent.CATEGORY_OPENABLE);i.setType("*/*");startActivityForResult(i,code);}
    @Override protected void onActivityResult(int request,int result,Intent data){
        super.onActivityResult(request,result,data);if(result!=RESULT_OK||data==null||data.getData()==null)return;Uri uri=data.getData();
        new Thread(()->{
            try{
                if(request==IMPORT_PACK){try(InputStream in=getContentResolver().openInputStream(uri)){if(in==null)throw new IOException("Datei nicht lesbar");File f=new File(getFilesDir(),"world-v3.pwf.zip");copyPack(in,f);openPack(f);}runOnUiThread(()->web.reload());}
                else if(request==IMPORT_SAVE){String text=readText(getContentResolver().openInputStream(uri),2*1024*1024);runOnUiThread(()->web.evaluateJavascript("window.receiveSave("+JSONObject.quote(text)+")",null));}
                else if(request==EXPORT_SAVE){try(OutputStream out=getContentResolver().openOutputStream(uri)){if(out==null)throw new IOException("Zieldatei nicht schreibbar");out.write(exportText.getBytes(StandardCharsets.UTF_8));}}
            }catch(Exception error){runOnUiThread(()->new AlertDialog.Builder(this).setTitle("Datei konnte nicht verarbeitet werden").setMessage(error.getMessage()).setPositiveButton("OK",null).show());}
        },"File-transfer").start();
    }
    final class Bridge {
        @JavascriptInterface public boolean ready(){return pack!=null;}
        @JavascriptInterface public String error(){return packError;}
        @JavascriptInterface public void importPack(){runOnUiThread(()->picker(IMPORT_PACK));}
        @JavascriptInterface public String load(){try{return readText(new AtomicFile(new File(getFilesDir(),"save-v3.json")).openRead(),2*1024*1024);}catch(Exception error){return "";}}
        @JavascriptInterface public synchronized boolean save(String json){
            if(json.length()>2*1024*1024)return false;AtomicFile file=new AtomicFile(new File(getFilesDir(),"save-v3.json"));FileOutputStream out=null;
            try{new JSONObject(json);out=file.startWrite();out.write(json.getBytes(StandardCharsets.UTF_8));file.finishWrite(out);return true;}catch(Exception error){if(out!=null)file.failWrite(out);return false;}
        }
        @JavascriptInterface public void exportSave(String json){exportText=json;runOnUiThread(()->{Intent i=new Intent(Intent.ACTION_CREATE_DOCUMENT);i.addCategory(Intent.CATEGORY_OPENABLE);i.setType("application/json");i.putExtra(Intent.EXTRA_TITLE,"Pokemon-with-friends-Spielstand.json");startActivityForResult(i,EXPORT_SAVE);});}
        @JavascriptInterface public void importSave(){runOnUiThread(()->picker(IMPORT_SAVE));}
    }
    @Override public void onBackPressed(){web.evaluateJavascript("window.pwfBack&&window.pwfBack()",null);}
    @Override protected void onPause(){super.onPause();if(web!=null){web.evaluateJavascript("window.pwfPause&&window.pwfPause()",null);web.onPause();}}
    @Override protected void onResume(){super.onResume();if(web!=null)web.onResume();}
    @Override protected void onDestroy(){if(web!=null){web.removeJavascriptInterface("Android");web.destroy();}try{if(pack!=null)pack.close();}catch(IOException ignored){}super.onDestroy();}
}
