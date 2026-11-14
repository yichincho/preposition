package tw.phrasemap.app;

import java.util.regex.Pattern;

/** Fixed provider hosts: the web page may choose a path, never the host, so a key can only reach its own provider. */
public final class AiEndpoints {
 private AiEndpoints(){}
 private static final Pattern GEMINI_PATH=Pattern.compile("^/v1beta/models(/[A-Za-z0-9._-]+:generateContent)?$");
 private static final Pattern OPENAI_PATH=Pattern.compile("^/(chat/completions|models)$");

 /** Returns the full URL, or null when the provider or path is not allowed. */
 public static String url(String provider,String path){
  if(provider==null||path==null)return null;
  switch(provider){
   case "GEMINI": return GEMINI_PATH.matcher(path).matches()?"https://generativelanguage.googleapis.com"+path:null;
   case "NVIDIA": return OPENAI_PATH.matcher(path).matches()?"https://integrate.api.nvidia.com/v1"+path:null;
   case "DEEPSEEK": return OPENAI_PATH.matcher(path).matches()?"https://api.deepseek.com"+path:null;
   default: return null;
  }
 }

 public static boolean usesGoogleHeader(String provider){return "GEMINI".equals(provider);}
}
