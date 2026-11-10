import com.techboard.streamboard.core.M3uParser;
import com.techboard.streamboard.core.CategoryClassifier;
import com.techboard.streamboard.model.Channel;
import java.util.*;
public class ParserTest {
    static void require(boolean ok, String message) { if(!ok) throw new AssertionError(message); }
    public static void main(String[] args) {
        String bdix="#EXTM3U url-tvg=\"https://example.test/epg.xml\"\n"
          +"#EXTINF:-1 tvg-id=\"GreenGoldTV.in\" tvg-name=\"Green Gold TV\" tvg-logo=\"https://img.test/logo.png\" tvg-language=\"hin\" group-title=\"Kids\",Green Gold TV\n"
          +"https://example.test/hls.m3u8\n"
          +"#EXTINF:-1 tvg-name=\"Geo News\" group-title=\"Pakistani\",Geo News\nhttp://example.test/live/index.m3u8\n";
        List<Channel> a=M3uParser.parse(bdix,"a","BDIX","https://example.test/all.m3u");
        require(a.size()==2,"BDIX parsed 2 channels");
        require(a.get(0).category.equals("Kids"),"Kids group");
        require(a.get(0).language.equals("Hindi"),"Hindi metadata");
        require(a.get(1).category.equals("Pakistan"),"Pakistan group");
        String vip="#EXTM3U\n#EXTINF:-1 tvg-name=\"IPTV LINKS\",IPTV LINKS\nhttps://github.com/intro.mp4\n#EXTINF:-1 tvg-id=\"header.fast.sports\" group-title=\"FAST Sports\",🔹 Sports\n"
          +"#EXTINF:-1 tvg-id=\"gazi.tv\" group-title=\"FAST Sports\",Gazi Tv\nhttps://example.test/gazi.m3u8\n"
          +"#EXTINF:-1 tvg-id=\"header.fast.kids\" group-title=\"FAST Kids\",🔹 Kids\n"
          +"#EXTINF:-1 tvg-id=\"pogo\" group-title=\"FAST Kids\",Pogo\nhttps://example.test/pogo.m3u8\n";
        List<Channel> b=M3uParser.parse(vip,"b","VIP","https://example.test/vip_kbpro.m3u8");
        require(b.size()==2,"VIP headers ignored");
        require(b.get(0).category.equals("Sports") && b.get(1).category.equals("Kids"),"FAST categories normalize");
        List<Channel> c=M3uParser.parse("#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:10\n#EXTINF:10,\nsegment0.ts\n","c","Direct","https://example.test/feed.m3u8");
        require(c.size()==1 && c.get(0).streamUrl.endsWith("feed.m3u8"),"direct HLS detected");
        require(!M3uParser.isUrl("file:///data/private"),"file scheme rejected");
        List<Channel> relative=M3uParser.parse("#EXTM3U\n#EXTINF:-1,Rel channel\n/channels/live.m3u8\n", "rel", "Relative", "https://example.test/folder/list.m3u");
        require(relative.size()==1 && relative.get(0).streamUrl.equals("https://example.test/channels/live.m3u8"),"relative URL resolved");
        System.out.println("PASS: BDIX metadata, categories, VIP group headers, direct HLS, URL validation");
    }
}
