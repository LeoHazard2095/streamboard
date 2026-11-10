package com.techboard.streamboard.core;

import com.techboard.streamboard.model.Channel;
import java.net.HttpURLConnection;
import java.net.URL;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Locale;

/** Checks reachability/manifest syntax, NOT whether the expected TV programme is playing. */
public final class StreamHealthChecker {
    private StreamHealthChecker(){}
    public static void check(Channel channel) {
        channel.status="CHECKING";
        HttpURLConnection c=null;
        try {
            if(!M3uParser.isUrl(channel.streamUrl))throw new IllegalArgumentException("Not an HTTP/HTTPS stream");
            c=(HttpURLConnection)new URL(channel.streamUrl).openConnection();
            c.setInstanceFollowRedirects(true);c.setConnectTimeout(7000);c.setReadTimeout(7500);
            c.setRequestProperty("Accept","application/vnd.apple.mpegurl,application/x-mpegURL,video/*,*/*");
            c.setRequestProperty("User-Agent","StreamBoard/1.0 (Android)");
            c.setRequestProperty("Range","bytes=0-4095");
            int http=c.getResponseCode();
            String type=String.valueOf(c.getContentType()).toLowerCase(Locale.ROOT);
            if(http==401||http==403||http==451) { channel.status="RESTRICTED"; channel.statusDetail="HTTP " +http+" (sign-in / region / permission)";return;}
            if(http==404||http==410) {channel.status="OFFLINE";channel.statusDetail="HTTP "+http;return;}
            if(http==429) {channel.status="UNVERIFIED";channel.statusDetail="Rate limited";return;}
            if(http<200||http>=300) {channel.status="UNVERIFIED";channel.statusDetail="HTTP "+http;return;}
            if(type.startsWith("video/")||type.startsWith("audio/" ) && !type.contains("mpegurl")) {
                channel.status="REACHABLE";channel.statusDetail="Media endpoint responds";return;
            }
            try(InputStream in=c.getInputStream()) {
                byte[] bytes=new byte[8192];int length=0;
                while(length<bytes.length) {int n=in.read(bytes,length,bytes.length-length);if(n<0)break;length+=n;}
                String body=new String(bytes,0,length,StandardCharsets.UTF_8).replace("\ufeff","");
                if(body.startsWith("#EXTM3U") && (body.contains("#EXT-X-") || type.contains("mpegurl"))) {
                    channel.status="REACHABLE";channel.statusDetail="HLS manifest responds";
                } else if(type.contains("mpegurl") && body.startsWith("#EXTM3U")) {
                    channel.status="REACHABLE";channel.statusDetail="M3U response";
                } else if(type.contains("text/html")||body.toLowerCase(Locale.ROOT).contains("<html")) {
                    channel.status="UNVERIFIED";channel.statusDetail="Website/login page, not stream";
                } else {
                    channel.status="UNVERIFIED";channel.statusDetail="HTTP "+http+"; stream format not confirmed";
                }
            }
        }catch(Exception e) {
            channel.status="UNREACHABLE";
            String message=e.getMessage();channel.statusDetail=message==null?"Network error":message.length()>75?message.substring(0,75):message;
        }finally {channel.checkedAt=System.currentTimeMillis();if(c!=null)c.disconnect();}
    }
}
