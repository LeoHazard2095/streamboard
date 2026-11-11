import com.techboard.streamboard.core.ChannelMerge;
import com.techboard.streamboard.model.Channel;
import com.techboard.streamboard.model.ChannelGroup;
import java.util.ArrayList;
import java.util.List;

/** Large multi-source fixture exercises matching without quadratic feed comparisons. */
public class PerformanceTest {
    public static void main(String[] args){
        List<Channel> all=new ArrayList<>();
        for(int n=0;n<8000;n++){
            Channel c=new Channel();c.name=n%2==0?"Cartoon Network HD":"Cartoon Network SD";
            c.streamUrl="https://streams.example/"+n+".m3u8";
            c.sourceName="Test";c.sourceId="fixture";c.category="Kids";
            c.language="Hindi";c.country="IN";
            all.add(c);
        }
        long start=System.nanoTime();
        List<ChannelGroup> groups=ChannelMerge.merge(all);
        long elapsed=(System.nanoTime()-start)/1_000_000L;
        if(groups.size()!=1||groups.get(0).feeds.size()!=8000)
            throw new AssertionError("Expected 8,000 source URLs within one channel");
        System.out.println("PASS: 8,000-feed multi-source stress fixture merged in "+elapsed+" ms");
    }
}
