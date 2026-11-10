import com.techboard.streamboard.core.ChannelMerge;
import com.techboard.streamboard.core.ChannelIdentity;
import com.techboard.streamboard.core.SourceSelector;
import com.techboard.streamboard.model.Channel;
import com.techboard.streamboard.model.ChannelGroup;
import java.util.*;
public class MergeTest {
    static Channel c(String name,String source,String country,String language,String url) {
        Channel c=new Channel();c.name=name;c.sourceId=source;c.sourceName=source;c.country=country;c.language=language;c.streamUrl=url;c.category="Kids";return c;
    }
    static void assertTrue(boolean v,String msg){if(!v)throw new AssertionError(msg);}
    public static void main(String[] a) {
        Channel cn1=c("Cartoon Network HD","one","IN","Hindi","https://tv1.test/cn.m3u8");
        Channel cn2=c("Cartoon Network SD","two","IN","Hindi","https://tv2.test/cn.m3u8");
        Channel cnSame=c("Cartoon Network","three","IN","Hindi","https://tv1.test/cn.m3u8");
        Channel cnUs=c("Cartoon Network","four","US","English","https://tv3.test/cn.m3u8");
        Channel sh1=c("Shin-chan 1080p","one","IN","Hindi","https://tv1.test/shin.m3u8");
        Channel sh2=c("Shin chan","two","IN","Hindi","https://tv2.test/shin.m3u8");
        List<ChannelGroup> groups=ChannelMerge.merge(Arrays.asList(cn1,cn2,cnSame,cnUs,sh1,sh2));
        assertTrue(groups.size()==3,"group count expected 3, got "+groups.size());
        ChannelGroup cn=groups.stream().filter(g->g.feeds.size()==2 && g.name.contains("Cartoon Network")).findFirst().orElseThrow();
        assertTrue(cn.feeds.size()==2,"dedupe urls and preserve 2 sources");
        assertTrue(groups.stream().anyMatch(g->g.feeds.size()==1 && g.name.equals("Cartoon Network")),"Different-language channel isolated");
        assertTrue(groups.stream().anyMatch(g->g.feeds.size()==2 && ChannelIdentity.canonicalName(g.name).equals("shin chan")),"Shin chan merged");
        Channel alias=c("Nick Jr. India","one","IN","Hindi","https://tv1.test/nick.m3u8");alias.tvgId="NickJr.in";
        Channel otherLabel=c("Nick Junior","two","IN","Hindi","https://tv2.test/nick.m3u8");otherLabel.tvgId="NickJr.in";
        assertTrue(ChannelMerge.merge(Arrays.asList(alias,otherLabel)).get(0).feeds.size()==2,"tvg-id aliases merged");
        Set<String> tried=new HashSet<>();
        List<Channel> fallback=Arrays.asList(cn1,cn2);
        tried.add(cn1.streamUrl);
        assertTrue(SourceSelector.next(fallback,tried,0)==1,"second source chosen on failure");
        tried.add(cn2.streamUrl);
        assertTrue(SourceSelector.next(fallback,tried,1)==-1,"no infinite retry after both fail");
        System.out.println("PASS: stable source identity, 2-source failover groups, tvg-id aliases, dedupe, country/language isolation");
    }
}
