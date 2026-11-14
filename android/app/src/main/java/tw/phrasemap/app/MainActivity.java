package tw.phrasemap.app;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.InputType;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.EditText;
import android.widget.LinearLayout;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONObject;

/**
 * WebView shell for the PhraseMap web app.
 * Pages are served from https://appassets.androidplatform.net/ so IndexedDB has a stable origin that survives app updates.
 * API keys stay in SecureKeyStore; JavaScript can ask whether a key exists but can never read it.
 */
public class MainActivity extends Activity {
 static final String HOST="appassets.androidplatform.net";
 static final String START_URL="https://"+HOST+"/www/index.html";
 private static final int REQ_FILE=1, REQ_SAVE=2;

 private WebView web;
 private SecureKeyStore keys;
 private final ExecutorService io=Executors.newFixedThreadPool(2);
 private final Handler main=new Handler(Looper.getMainLooper());
 private ValueCallback<Uri[]> fileCallback;
 private String pendingSaveId, pendingSaveText;

 @Override protected void onCreate(Bundle state){
  super.onCreate(state);
  keys=new SecureKeyStore(this);
  web=new WebView(this);
  setContentView(web);
  // Android 15 強制 edge-to-edge：留出狀態列與導覽列空間
  web.setOnApplyWindowInsetsListener((v,insets)->{
   if(android.os.Build.VERSION.SDK_INT>=30){
    android.graphics.Insets i=insets.getInsets(android.view.WindowInsets.Type.systemBars()|android.view.WindowInsets.Type.ime());
    v.setPadding(i.left,i.top,i.right,i.bottom);
   }
   return insets;
  });
  WebSettings s=web.getSettings();
  s.setJavaScriptEnabled(true);
  s.setDomStorageEnabled(true);
  s.setDatabaseEnabled(true);
  s.setAllowFileAccess(false);
  s.setAllowContentAccess(false);
  s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
  web.setWebViewClient(new WebViewClient(){
   @Override public WebResourceResponse shouldInterceptRequest(WebView v,WebResourceRequest r){
    Uri u=r.getUrl();
    if(!HOST.equals(u.getHost()))return null;
    return asset(u.getPath());
   }
   @Override public boolean shouldOverrideUrlLoading(WebView v,WebResourceRequest r){
    Uri u=r.getUrl();
    if(HOST.equals(u.getHost()))return false;
    try{startActivity(new Intent(Intent.ACTION_VIEW,u));}catch(Exception ignored){}
    return true;
   }
  });
  web.setWebChromeClient(new WebChromeClient(){
   @Override public boolean onShowFileChooser(WebView v,ValueCallback<Uri[]> cb,FileChooserParams p){
    if(fileCallback!=null)fileCallback.onReceiveValue(null);
    fileCallback=cb;
    try{startActivityForResult(p.createIntent(),REQ_FILE);}catch(Exception e){fileCallback=null;return false;}
    return true;
   }
  });
  web.addJavascriptInterface(new Bridge(),"PhraseMapNative");
  if(state!=null)web.restoreState(state);else web.loadUrl(START_URL);
 }

 private WebResourceResponse asset(String path){
  if(path==null||path.contains(".."))return null;
  String p=path.startsWith("/")?path.substring(1):path;
  String mime=p.endsWith(".html")?"text/html":p.endsWith(".js")?"application/javascript":p.endsWith(".json")?"application/json":p.endsWith(".css")?"text/css":p.endsWith(".png")?"image/png":p.endsWith(".svg")?"image/svg+xml":"application/octet-stream";
  try{return new WebResourceResponse(mime,"utf-8",getAssets().open(p));}catch(Exception e){return null;}
 }

 @Override protected void onSaveInstanceState(Bundle out){super.onSaveInstanceState(out);web.saveState(out);}
 @Override public void onBackPressed(){if(web.canGoBack())web.goBack();else super.onBackPressed();}
 @Override protected void onDestroy(){io.shutdownNow();web.destroy();super.onDestroy();}

 @Override protected void onActivityResult(int req,int result,Intent data){
  super.onActivityResult(req,result,data);
  if(req==REQ_FILE&&fileCallback!=null){
   fileCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result,data));
   fileCallback=null;
  }else if(req==REQ_SAVE&&pendingSaveId!=null){
   final String id=pendingSaveId,text=pendingSaveText;
   pendingSaveId=null;pendingSaveText=null;
   if(result!=RESULT_OK||data==null||data.getData()==null){fail(id,"已取消儲存");return;}
   final Uri uri=data.getData();
   io.execute(()->{
    try(OutputStream out=getContentResolver().openOutputStream(uri)){
     out.write(text.getBytes(StandardCharsets.UTF_8));
     ok(id,new JSONObject());
    }catch(Exception e){fail(id,"儲存失敗："+e.getMessage());}
   });
  }
 }

 private void ok(String id,JSONObject o){
  try{o.put("ok",true);}catch(Exception ignored){}
  deliver(id,o);
 }
 private void fail(String id,String msg){
  JSONObject o=new JSONObject();
  try{o.put("ok",false);o.put("error",msg);}catch(Exception ignored){}
  deliver(id,o);
 }
 private void deliver(String id,JSONObject o){
  final String js="window.__phNative&&window.__phNative.resolve("+JSONObject.quote(id)+","+JSONObject.quote(o.toString())+")";
  main.post(()->web.evaluateJavascript(js,null));
 }

 static String readAll(InputStream in)throws Exception{
  if(in==null)return "";
  try(InputStream s=in){
   ByteArrayOutputStream b=new ByteArrayOutputStream();byte[] buf=new byte[8192];int n;
   while((n=s.read(buf))>0){b.write(buf,0,n);if(b.size()>8*1024*1024)throw new Exception("回應過大");}
   return b.toString("UTF-8");
  }
 }

 final class Bridge {
  @JavascriptInterface public boolean hasKey(String provider){return keys.has(provider);}
  @JavascriptInterface public void clearKey(String provider){keys.clear(provider);}
  @JavascriptInterface public void copyText(String text){
   ClipboardManager cm=(ClipboardManager)getSystemService(Context.CLIPBOARD_SERVICE);
   if(cm!=null)cm.setPrimaryClip(ClipData.newPlainText("PhraseMap",text));
  }

  /** Shows a native password dialog, so the key never passes through the web page. */
  @JavascriptInterface public void promptKey(final String id,final String provider){
   if(AiEndpoints.url(provider,"GEMINI".equals(provider)?"/v1beta/models":"/models")==null){fail(id,"不支援的服務商");return;}
   main.post(()->{
    final EditText input=new EditText(MainActivity.this);
    input.setInputType(InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_VARIATION_PASSWORD);
    input.setHint(provider+" API key");
    LinearLayout box=new LinearLayout(MainActivity.this);
    box.setPadding(48,16,48,0);box.addView(input,new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT,LinearLayout.LayoutParams.WRAP_CONTENT));
    new AlertDialog.Builder(MainActivity.this)
     .setTitle("設定 "+provider+" API 金鑰")
     .setMessage("金鑰以 Android Keystore 加密存在這支手機，不會出現在網頁、備份檔或 GitHub。")
     .setView(box)
     .setPositiveButton("儲存",(d,w)->{
      try{keys.save(provider,input.getText().toString());ok(id,new JSONObject());}
      catch(Exception e){fail(id,"儲存失敗："+e.getMessage());}
     })
     .setNegativeButton("取消",(d,w)->fail(id,"已取消"))
     .setOnCancelListener(d->fail(id,"已取消"))
     .show();
   });
  }

  /** Calls the provider with the stored key. Host is fixed per provider; only the path comes from JavaScript. */
  @JavascriptInterface public void aiRequest(final String id,final String provider,final String path,final String body,final int timeoutMs){
   io.execute(()->{
    HttpURLConnection c=null;
    try{
     String url=AiEndpoints.url(provider,path);
     if(url==null){fail(id,"不允許的 AI 端點");return;}
     String key=keys.get(provider);
     if(key.isEmpty()){fail(id,"尚未設定 "+provider+" 金鑰，請到「AI 設定」設定");return;}
     c=(HttpURLConnection)new URL(url).openConnection();
     c.setInstanceFollowRedirects(false); // never forward the key to another host
     int t=Math.max(5000,Math.min(timeoutMs,180000));
     c.setConnectTimeout(15000);c.setReadTimeout(t);
     c.setRequestProperty("Accept","application/json");
     if(AiEndpoints.usesGoogleHeader(provider))c.setRequestProperty("x-goog-api-key",key);
     else c.setRequestProperty("Authorization","Bearer "+key);
     if(body!=null&&!body.isEmpty()){
      c.setRequestMethod("POST");c.setDoOutput(true);
      c.setRequestProperty("Content-Type","application/json; charset=utf-8");
      try(OutputStream out=c.getOutputStream()){out.write(body.getBytes(StandardCharsets.UTF_8));}
     }else c.setRequestMethod("GET");
     int status=c.getResponseCode();
     String text=readAll(status>=400?c.getErrorStream():c.getInputStream());
     JSONObject o=new JSONObject();o.put("status",status);o.put("body",text);
     ok(id,o);
    }catch(java.net.SocketTimeoutException e){fail(id,"連線逾時，請稍後再試");}
    catch(Exception e){fail(id,"網路錯誤："+e.getMessage());}
    finally{if(c!=null)c.disconnect();}
   });
  }

  /** Lets the user pick where to save a backup (Storage Access Framework). */
  @JavascriptInterface public void saveFile(final String id,final String name,final String mime,final String text){
   main.post(()->{
    if(pendingSaveId!=null)fail(pendingSaveId,"已被新的儲存取代");
    pendingSaveId=id;pendingSaveText=text;
    Intent i=new Intent(Intent.ACTION_CREATE_DOCUMENT);
    i.addCategory(Intent.CATEGORY_OPENABLE);i.setType(mime);i.putExtra(Intent.EXTRA_TITLE,name);
    try{startActivityForResult(i,REQ_SAVE);}catch(Exception e){pendingSaveId=null;pendingSaveText=null;fail(id,"無法開啟儲存畫面");}
   });
  }
 }
}
