package com.techboard.streamboard.core;

import java.util.Locale;

public final class CategoryClassifier {
    private CategoryClassifier() {}
    public static String assign(String group, String name) {
        String raw = group == null ? "" : group.trim();
        String g = raw.toLowerCase(Locale.ROOT).replace('_',' ');
        String n = name == null ? "" : name.toLowerCase(Locale.ROOT);
        String combined = g + " " + n;
        if (matches(combined, "kids", "cartoon", "toons", "nickelodeon", "nick jr", "disney junior", "pogo", "shin chan", "shin-chan", "doraemon", "baby", "cbeebies", "chhota bheem", "moonbug", "minimax", "sonic", "smurf")) return "Kids";
        if (matches(g,"sports", "cricket", "football", "fifa", "sport")) return "Sports";
        if (matches(g,"news", "current affairs")) return "News";
        if (matches(g,"movie", "cinema", "film")) return "Movies";
        if (matches(g,"music", "songs")) return "Music";
        if (matches(g,"documentary", "wildlife", "nature", "science")) return "Documentary";
        if (matches(g,"religious", "islamic", "quran", "faith", "spiritual")) return "Religious";
        if (matches(g,"entertainment", "drama", "comedy", "lifestyle")) return "Entertainment";
        if (matches(g,"international", "worldwide")) return "International";
        if (matches(g,"pakistan", "pakistani")) return "Pakistan";
        if (matches(g,"bangladesh", "bangla", "bdix")) return "Bangladesh";
        // Only infer by channel name when source group supplies no category.
        if (raw.isEmpty()) {
            if (matches(n,"sport", "cricket", "espn", "willow")) return "Sports";
            if (matches(n,"news", "bbc world", "cnn", "al jazeera")) return "News";
            if (matches(n,"movie", "cinema", "film")) return "Movies";
            if (matches(n,"music", "mtv")) return "Music";
            if (matches(n,"quran", "islamic", "makkah")) return "Religious";
        }
        if (!raw.isEmpty()) {
            String cleaned = raw.replaceFirst("(?i)^(FAST|SLOW)[\\s:_-]+", "").trim();
            if (!cleaned.isEmpty() && cleaned.length() <= 35 && !cleaned.equalsIgnoreCase("fast") && !cleaned.equalsIgnoreCase("slow")) return cleaned;
        }
        return "Other";
    }
    private static boolean matches(String value, String... terms) {
        for(String t: terms) if(value.contains(t)) return true;
        return false;
    }
    public static String languageName(String value) {
        if (value==null || value.trim().isEmpty()) return "Unknown";
        String key=value.trim().toLowerCase(Locale.ROOT);
        switch(key) {
            case "hin": case "hi": case "hindi": return "Hindi";
            case "urd": case "ur": case "urdu": return "Urdu";
            case "eng": case "en": case "english": return "English";
            case "ben": case "bn": case "bangla": case "bengali": return "Bengali";
            case "tam": case "ta": return "Tamil";
            case "tel": case "te": return "Telugu";
            case "ara": case "ar": return "Arabic";
            default: return value.trim();
        }
    }
}
