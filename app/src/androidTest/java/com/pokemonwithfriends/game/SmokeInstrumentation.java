package com.pokemonwithfriends.game;

import android.app.*;
import android.content.Intent;
import android.os.Bundle;
import android.view.ViewGroup;
import android.webkit.WebView;
import java.io.*;
import java.util.concurrent.*;
import org.json.JSONArray;

/** Actual Android WebView + Java bridge integration, with synthetic non-game data. */
public class SmokeInstrumentation extends Instrumentation {
    private WebView web;
    @Override public void onCreate(Bundle arguments){super.onCreate(arguments);start();}
    @Override public void onStart(){
        Bundle result=new Bundle();
        try{
            try(InputStream in=getContext().getAssets().open("synthetic.pwf.zip");OutputStream out=new FileOutputStream(new File(getTargetContext().getFilesDir(),"world-v3.pwf.zip"))){byte[] b=new byte[8192];int n;while((n=in.read(b))!=-1)out.write(b,0,n);}
            new File(getTargetContext().getFilesDir(),"save-v3.json").delete();
            Intent launch=new Intent(getTargetContext(),MainActivity.class);launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            Activity activity=startActivitySync(launch);
            runOnMainSync(()->web=(WebView)((ViewGroup)activity.findViewById(android.R.id.content)).getChildAt(0));
            waitText("Dein Abenteuer. Deine Figur.");
            clickText("Starter wählen  ›");waitText("Mit wem beginnt deine Reise?");
            js("(document.querySelector('.card button').click(), 'ok')");waitText("Teststadt");
            require(js("String(!!document.querySelector('#world'))").equals("true"),"World canvas is missing");
            clickText("Team");waitText("Dein Team");require(js("String(document.querySelectorAll('.row').length)").equals("1"),"Starter missing");
            clickText("Zurück");waitText("Teststadt");clickText("Menü");waitText("Dein Abenteuer");clickText("Pokécenter & Markt");waitText("Pokécenter · kostenlos heilen");clickText("Pokécenter · kostenlos heilen");waitText("Dein Team ist wieder fit");
            require(new File(getTargetContext().getFilesDir(),"save-v3.json").length()>100,"Native save bridge did not persist progress");
            result.putString("stream","PWF_SMOKE_OK: pack load, trainer/starter selection, world canvas, team, center and native save bridge passed\n");
            finish(Activity.RESULT_OK,result);
        }catch(Throwable error){result.putString("stream","PWF_SMOKE_FAILED: "+error.toString()+"\n");finish(Activity.RESULT_CANCELED,result);}
    }
    private String js(String code)throws Exception{
        CountDownLatch latch=new CountDownLatch(1);String[] value={""};
        runOnMainSync(()->web.evaluateJavascript("(function(){return ("+code+");})()",v->{value[0]=v;latch.countDown();}));
        if(!latch.await(10,TimeUnit.SECONDS))throw new IOException("JavaScript evaluation timed out");
        String raw=value[0];return new JSONArray("["+raw+"]").getString(0);
    }
    private void clickText(String text)throws Exception{
        String quoted=org.json.JSONObject.quote(text);
        String code="(function(){var b=Array.from(document.querySelectorAll('button')).find(x=>x.textContent.trim()==="+quoted+"); if(!b)throw Error('Button missing'); b.click(); return 'ok';})()";
        js(code);
    }
    private void waitText(String text)throws Exception{
        long deadline=System.currentTimeMillis()+25000;
        while(System.currentTimeMillis()<deadline){String body=js("document.body.innerText");if(body.contains(text))return;Thread.sleep(150);}
        throw new IOException("Missing UI text: "+text+"; current: "+js("document.body.innerText"));
    }
    private void require(boolean condition,String message)throws IOException{if(!condition)throw new IOException(message);}
}
