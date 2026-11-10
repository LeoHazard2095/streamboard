package com.techboard.streamboard.core;

import com.techboard.streamboard.model.Channel;
import java.text.Normalizer;
import java.util.Locale;

/** Conservative channel matching. Quality suffixes don't change a broadcaster's identity.
 * Distinct countries/languages never auto-merge when both are known. */
public final class ChannelIdentity {
    private ChannelIdentity() {}
    public static String canonicalName(String input) {
        if(input==null) return "";
        String normalized=Normalizer.normalize(input,Normalizer.Form.NFD).replaceAll("\\p{M}+", "")
            .toLowerCase(Locale.ROOT).replace('&',' ').replace('+',' ')
            .replaceAll("(?i)\\b(?:fhd|full\\s*hd|uhd|4k|8k|hd|sd|1080p|720p|60fps|50fps)\\b", "")
            .replaceAll("[^\\p{L}\\p{N}]+", " ").trim().replaceAll("\\s+", " ");
        return normalized;
    }
    public static boolean same(Channel a, Channel b) {
        if(a==null||b==null) return false;
        if(!compatible(a.country,b.country)||!compatible(a.language,b.language)) return false;
        String idA=validTvgId(a.tvgId), idB=validTvgId(b.tvgId);
        if(!idA.isEmpty() && idA.equals(idB))return true;
        String na=canonicalName(a.name), nb=canonicalName(b.name);
        return na.length()>=3 && na.equals(nb);
    }
    public static String validTvgId(String id) {
        if(id==null)return "";
        String out=id.trim().toLowerCase(Locale.ROOT);
        if(out.isEmpty()||out.equals("-1")||out.equals("0")||out.equals("unknown")||out.startsWith("header."))return "";
        return out;
    }
    public static boolean compatible(String a, String b) {
        return a==null || b==null || a.trim().isEmpty() || b.trim().isEmpty() || a.equalsIgnoreCase(b);
    }
    public static String stableKey(Channel c) {
        String name=canonicalName(c.name);
        if(name.isEmpty()) name="channel";
        // Stable when a playlist gains a logo, tvg-id, stream token, or source.
        return "name:"+name;
    }
}
