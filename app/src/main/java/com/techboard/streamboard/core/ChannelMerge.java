package com.techboard.streamboard.core;

import com.techboard.streamboard.model.Channel;
import com.techboard.streamboard.model.ChannelGroup;
import java.util.*;

/** Merges channels across playlist sources using usable tvg-id first, then conservative name matching.
 * Country/language conflicts stay separate. Repeated URLs never add duplicate fallbacks. */
public final class ChannelMerge {
    private ChannelMerge() {}
    public static List<ChannelGroup> merge(List<Channel> raw) {
        List<ChannelGroup> groups=new ArrayList<>();
        Map<String,List<ChannelGroup>> byName=new LinkedHashMap<>();
        Map<String,List<ChannelGroup>> byTvgId=new LinkedHashMap<>();
        for(Channel channel:raw) {
            if(channel==null || !M3uParser.isUrl(channel.streamUrl))continue;
            String nameKey=ChannelIdentity.stableKey(channel);
            String tvgKey=ChannelIdentity.validTvgId(channel.tvgId);
            ChannelGroup target=findMatch(byTvgId.get(tvgKey),channel);
            if(target==null) target=findMatch(byName.get(nameKey),channel);
            if(target==null) {
                List<ChannelGroup> similarlyNamed=byName.get(nameKey);
                int suffix=similarlyNamed==null?0:similarlyNamed.size();
                String id=nameKey+(suffix==0?"":"#"+suffix);
                target=new ChannelGroup(id,channel);groups.add(target);
            }else target.add(channel);
            List<ChannelGroup> names=byName.computeIfAbsent(nameKey,k->new ArrayList<>());
            if(!names.contains(target))names.add(target);
            if(!tvgKey.isEmpty()){
                List<ChannelGroup> ids=byTvgId.computeIfAbsent(tvgKey,k->new ArrayList<>());
                if(!ids.contains(target))ids.add(target);
            }
        }
        groups.sort((a,b)->String.CASE_INSENSITIVE_ORDER.compare(a.name,b.name));
        return groups;
    }
    private static ChannelGroup findMatch(List<ChannelGroup> candidates, Channel incoming) {
        if(candidates==null)return null;
        for(ChannelGroup candidate:candidates) {
            for(Channel existing:candidate.feeds) if(ChannelIdentity.same(existing,incoming)) return candidate;
        }
        return null;
    }
}
