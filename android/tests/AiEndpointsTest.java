import tw.phrasemap.app.AiEndpoints;

public class AiEndpointsTest {
 static void check(boolean c,String m){if(!c)throw new AssertionError(m);}
 public static void main(String[] a){
  check("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent".equals(AiEndpoints.url("GEMINI","/v1beta/models/gemini-3.8-flash:generateContent")),"gemini");
  check("https://integrate.api.nvidia.com/v1/chat/completions".equals(AiEndpoints.url("NVIDIA","/chat/completions")),"nvidia");
  check("https://api.deepseek.com/chat/completions".equals(AiEndpoints.url("DEEPSEEK","/chat/completions")),"deepseek");
  check(AiEndpoints.url("GEMINI","/v1beta/models/x:generateContent?key=1")==null,"query rejected");
  check(AiEndpoints.url("NVIDIA","@evil.com/chat/completions")==null,"host injection rejected");
  check(AiEndpoints.url("NVIDIA","/../chat/completions")==null,"traversal rejected");
  check(AiEndpoints.url("OPENAI","/chat/completions")==null,"unknown provider");
  check(AiEndpoints.url("GEMINI","/v1beta/models/../../x:generateContent")==null,"gemini traversal");
  check(AiEndpoints.usesGoogleHeader("GEMINI")&&!AiEndpoints.usesGoogleHeader("NVIDIA"),"headers");
  System.out.println("AiEndpointsTest OK");
 }
}
