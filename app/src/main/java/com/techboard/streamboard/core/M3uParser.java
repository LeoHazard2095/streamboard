package com.techboard.streamboard.core;

import com.techboard.streamboard.model.Channel;
import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Parses IPTV M3U, including playlists whose file extension is .m3u8.
 *  #EXT-X manifests are instead treated as one HLS stream. */
public final class M3uParser {
    private static final Pattern ATTR = Pattern.compile("([A-Za-z0-9_-]+)\\s*=\\s*\"([^\"]*)\"");
    public static final int MAX_CHANNELS = 12000;
    private M3uParser() {}
    public static List<Channel> parse(String text, String sourceId, String sourceName, String baseUrl) {
        List<Channel> result = new ArrayList<>();
        if (text == null || text.trim().isEmpty()) return result;
        if (text.contains("#EXT-X-STREAM-INF") || text.contains("#EXT-X-TARGETDURATION") || text.contains("#EXT-X-MEDIA-SEQUENCE")) {
            Channel direct = new Channel(); direct.sourceId=sourceId; direct.sourceName=sourceName;
            direct.name=sourceName + " Live"; direct.streamUrl=baseUrl; direct.category="Live TV";
            if (isUrl(baseUrl)) result.add(direct);
            return result;
        }
        Channel pending = null;
        String currentGroup="";
        for(String raw : text.split("\\r?\\n")) {
            String line=raw.trim();
            if(line.trim().isEmpty()) continue;
            if(line.startsWith("#EXTGRP:")) { currentGroup=line.substring(8).trim(); continue; }
            if(line.startsWith("#EXTINF:")) {
                pending=new Channel(); pending.sourceId=sourceId; pending.sourceName=sourceName;
                Matcher matcher=ATTR.matcher(line);
                while(matcher.find()) {
                    String val=unescape(matcher.group(2));
                    switch(matcher.group(1).toLowerCase(Locale.ROOT)) {
                        case "tvg-name": pending.name=val; break;
                        case "tvg-logo": pending.logoUrl=val; break;
                        case "tvg-id": pending.tvgId=val; break;
                        case "tvg-language": pending.language=CategoryClassifier.languageName(val); break;
                        case "tvg-country": pending.country=val; break;
                        case "group-title": pending.group=val; break;
                    }
                }
                int lastComma=line.lastIndexOf(',');
                if(lastComma>=0 && lastComma+1<line.length()) {
                    String label=unescape(line.substring(lastComma+1).trim());
                    if(!label.trim().isEmpty()) pending.name=label;
                }
                if(pending.group.trim().isEmpty()) pending.group=currentGroup;
                continue;
            }
            if(line.startsWith("#")) continue;
            String resolved=resolve(baseUrl,line);
            if(!isUrl(resolved)) { pending=null; continue; }
            if(pending==null) continue;
            // VIP playlists contain faux heading #EXTINF lines with no URL; these are overwritten by next entry.
            if(pending.name.startsWith("🔹") || pending.name.startsWith("⚡") || pending.tvgId.startsWith("header.")
               || pending.name.equalsIgnoreCase("IPTV LINKS")) { pending=null; continue; }
            pending.streamUrl=resolved;
            if(pending.name.trim().isEmpty()) pending.name="Channel " +(result.size()+1);
            pending.category=CategoryClassifier.assign(pending.group,pending.name);
            result.add(pending);
            pending=null;
            if(result.size()>=MAX_CHANNELS) break;
        }
        return result;
    }
    public static boolean isUrl(String url) {
        if(url==null) return false;
        try {
            URI uri=new URI(url.trim());
            String scheme=uri.getScheme();
            return ("http".equalsIgnoreCase(scheme)||"https".equalsIgnoreCase(scheme)) && uri.getHost()!=null;
        } catch(Exception e) { return false; }
    }
    private static String resolve(String base,String ref) {
        try { return URI.create(base).resolve(ref).toString(); }
        catch(Exception e) { return ref; }
    }
    private static String unescape(String s) {
        return s.replace("&amp;","&").replace("&quot;","\"").replace("&#39;", "'").replace("&lt;","<").replace("&gt;",">");
    }
}
