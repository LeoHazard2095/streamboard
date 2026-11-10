package com.techboard.streamboard.core;

import com.techboard.streamboard.model.Channel;
import java.util.List;
import java.util.Set;

/** Choose an untried alternative after a failed stream, without endless cycling. */
public final class SourceSelector {
    private SourceSelector() {}
    public static int next(List<Channel> feeds,Set<String> attempted,int current) {
        if(feeds==null||feeds.isEmpty())return -1;
        for(int offset=1;offset<=feeds.size();offset++){
            int index=(current+offset+feeds.size())%feeds.size();
            if(!attempted.contains(feeds.get(index).streamUrl))return index;
        }
        return -1;
    }
}
