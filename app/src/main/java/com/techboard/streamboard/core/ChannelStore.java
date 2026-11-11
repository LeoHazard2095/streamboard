package com.techboard.streamboard.core;

import android.content.Context;
import android.content.SharedPreferences;
import com.techboard.streamboard.model.Channel;
import com.techboard.streamboard.model.ChannelGroup;
import com.techboard.streamboard.model.PlaylistSource;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;

/** Offline channel catalogue. Source replacement never destroys another playlist's entries. */
public final class ChannelStore {
    public static final String BDIX = "https://raw.githubusercontent.com/saeidrahmanbd/BDIX-IPTV/main/IPTV-Playlist.m3u";
    public static final String LIVE_TG = "https://livetgtv.lovable.app/api/public/playlist.m3u";
    public static final String VIP = "https://raw.githubusercontent.com/Mrbotrx/VIP-m3u-playlist/refs/heads/main/Vip%20playlists/vip_kbpro.m3u8";
    private final Context context;
    private final SharedPreferences pref;
    private final List<PlaylistSource> sources = new ArrayList<>();
    private final List<Channel> channels = new ArrayList<>();
    private final Set<String> favorites = new HashSet<>();
    private final Map<String,String> overrides = new HashMap<>();
    private final Set<String> allowed = new HashSet<>();
    private final Set<String> hiddenCategories = new HashSet<>();
    private final Map<String,String> preferred = new HashMap<>();

    public ChannelStore(Context context) {
        this.context=context.getApplicationContext();
        this.pref=this.context.getSharedPreferences("streamboard",Context.MODE_PRIVATE);
        loadSources(); loadFavorites(); loadPermissions(); loadChannels();
    }
    private void loadSources() {
        try {
            String src=pref.getString("sources","");
            if(!src.trim().isEmpty()) {
                JSONArray a=new JSONArray(src);
                for(int i=0;i<a.length();i++) {
                    JSONObject o=a.getJSONObject(i);
                    if(M3uParser.isUrl(o.optString("url"))) sources.add(new PlaylistSource(o.optString("id"),o.optString("title"),o.optString("url")));
                }
            }
            if(!pref.contains("sources")) {
                sources.add(new PlaylistSource("bdix","BDIX IPTV",BDIX));
                sources.add(new PlaylistSource("vip","VIP KB Pro",VIP));
                sources.add(new PlaylistSource("live-tg","Live TG TV",LIVE_TG));
                pref.edit().putBoolean("live_tg_v11_added",true).apply();
                saveSources();
            }
            // One-time migration preserves existing approvals and previously imported entries.
            if (!pref.getBoolean("live_tg_v11_added",false)) {
                boolean exists=false;
                for(PlaylistSource source:sources) if(LIVE_TG.equals(source.url)) exists=true;
                if(!exists) {sources.add(new PlaylistSource("live-tg","Live TG TV",LIVE_TG));saveSources();}
                pref.edit().putBoolean("live_tg_v11_added",true).apply();
            }
        } catch(Exception e) { sources.clear(); }
    }
    private void saveSources() {
        JSONArray a=new JSONArray();
        for(PlaylistSource s:sources) {
            JSONObject o=new JSONObject();
            try {o.put("id",s.id);o.put("title",s.title);o.put("url",s.url);a.put(o);}catch(Exception ignored){}
        }
        pref.edit().putString("sources",a.toString()).apply();
    }
    public synchronized List<PlaylistSource> sources() { return new ArrayList<>(sources); }
    public synchronized List<Channel> rawChannels() { return new ArrayList<>(channels); }
    public synchronized List<ChannelGroup> mergedChannels() {
        List<ChannelGroup> result = ChannelMerge.merge(channels);
        for(ChannelGroup g:result) {
            if(overrides.containsKey(g.id)) g.category=overrides.get(g.id);
            g.allowed=allowed.contains(g.id);
        }
        return result;
    }
    public synchronized ChannelGroup findGroup(String id) {
        for(ChannelGroup group:mergedChannels())if(group.id.equals(id))return group;
        return null;
    }
    public synchronized boolean isAllowed(String id) {return allowed.contains(id);}
    public synchronized void setAllowed(String id, boolean value) {
        if(value)allowed.add(id);else allowed.remove(id);
        pref.edit().putStringSet("allowed",new HashSet<>(allowed)).apply();
    }
    public synchronized boolean categoryVisible(String category) {return !hiddenCategories.contains(category);}
    public synchronized void setCategoryVisible(String category,boolean value) {
        if(value)hiddenCategories.remove(category);else hiddenCategories.add(category);
        pref.edit().putStringSet("hiddenCategories",new HashSet<>(hiddenCategories)).apply();
    }
    public synchronized String preferredSource(String id) {return preferred.getOrDefault(id,"");}
    public synchronized void setPreferredSource(String id,String url) {
        if(url==null||url.trim().isEmpty()) preferred.remove(id);else preferred.put(id,url);
        JSONObject o=new JSONObject();for(Map.Entry<String,String> e:preferred.entrySet())try{o.put(e.getKey(),e.getValue());}catch(Exception ignored){}
        pref.edit().putString("preferred",o.toString()).apply();
    }
    public synchronized void overrideCategory(ChannelGroup group,String category) {
        overrides.put(group.id,category);
        JSONObject o=new JSONObject();for(Map.Entry<String,String> e:overrides.entrySet())try{o.put(e.getKey(),e.getValue());}catch(Exception ignored){}
        pref.edit().putString("overrides",o.toString()).apply();
    }
    public synchronized boolean isFavorite(ChannelGroup group) {return favorites.contains(group.id);}
    public synchronized void toggleFavorite(ChannelGroup group) {
        if(!favorites.add(group.id))favorites.remove(group.id);
        pref.edit().putStringSet("favoritesV2",new HashSet<>(favorites)).apply();
    }
    public synchronized boolean addSource(String title, String url) {
        if(!M3uParser.isUrl(url)) return false;
        for(PlaylistSource s:sources) if(s.url.equals(url.trim())) return false;
        sources.add(new PlaylistSource(UUID.randomUUID().toString(),title.trim(),url.trim()));
        saveSources(); return true;
    }
    public synchronized void removeSource(String id) {
        sources.removeIf(s->s.id.equals(id));
        channels.removeIf(c->c.sourceId.equals(id));
        saveSources(); saveChannels();
    }
    public synchronized void replaceSourceChannels(String id,List<Channel> incoming) {
        channels.removeIf(c->c.sourceId.equals(id));
        channels.addAll(incoming);
        saveChannels();
    }
    private void loadFavorites() {
        favorites.addAll(pref.getStringSet("favoritesV2",Collections.emptySet()));
        try {JSONObject o=new JSONObject(pref.getString("overrides","{}"));Iterator<String> keys=o.keys();while(keys.hasNext()){String key=keys.next();overrides.put(key,o.optString(key));}}catch(Exception ignored){}
    }
    private void loadPermissions() {
        allowed.addAll(pref.getStringSet("allowed",Collections.emptySet()));
        hiddenCategories.addAll(pref.getStringSet("hiddenCategories",Collections.emptySet()));
        try {JSONObject o=new JSONObject(pref.getString("preferred","{}"));Iterator<String> keys=o.keys();while(keys.hasNext()){String key=keys.next();preferred.put(key,o.optString(key));}}catch(Exception ignored){}
    }
    private void loadChannels() {
        File f=new File(context.getFilesDir(),"channels.json");if(!f.exists())return;
        try (InputStream input=new FileInputStream(f)) {
            ByteArrayOutputStream out=new ByteArrayOutputStream();byte[] buf=new byte[8192];int n;
            while((n=input.read(buf))!=-1 && out.size()<12_000_000)out.write(buf,0,n);
            JSONArray a=new JSONArray(out.toString(StandardCharsets.UTF_8.name()));
            for(int i=0;i<a.length();i++) {
                JSONObject o=a.getJSONObject(i); Channel c=new Channel();
                c.sourceId=o.optString("sourceId");c.sourceName=o.optString("sourceName");
                c.name=o.optString("name");c.streamUrl=o.optString("streamUrl");
                c.logoUrl=o.optString("logoUrl");c.tvgId=o.optString("tvgId");
                c.language=o.optString("language");c.country=o.optString("country");
                c.group=o.optString("group");c.category=o.optString("category","Other");
                if(M3uParser.isUrl(c.streamUrl))channels.add(c);
            }
        }catch(Exception ignored){}
    }
    private synchronized void saveChannels() {
        JSONArray a=new JSONArray();
        for(Channel c:channels) {
            JSONObject o=new JSONObject();
            try {
                o.put("sourceId",c.sourceId);o.put("sourceName",c.sourceName);
                o.put("name",c.name);o.put("streamUrl",c.streamUrl);
                o.put("logoUrl",c.logoUrl);o.put("tvgId",c.tvgId);
                o.put("language",c.language);o.put("country",c.country);
                o.put("group",c.group);o.put("category",c.category);
                a.put(o);
            }catch(Exception ignored){}
        }
        File tmp=new File(context.getFilesDir(),"channels.json.tmp");
        File dest=new File(context.getFilesDir(),"channels.json");
        try (OutputStream out=new FileOutputStream(tmp)) {out.write(a.toString().getBytes(StandardCharsets.UTF_8));}
        catch(Exception ignored){return;}
        if(!tmp.renameTo(dest)) {
            try (InputStream input=new FileInputStream(tmp);OutputStream output=new FileOutputStream(dest)) {
                byte[] buffer=new byte[8192];int n;while((n=input.read(buffer))!=-1)output.write(buffer,0,n);
            }catch(Exception ignored){} finally {tmp.delete();}
        }
    }
}
