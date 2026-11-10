package com.techboard.streamboard.core;

import java.net.HttpURLConnection;
import java.net.URL;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

public final class PlaylistDownloader {
    private static final int LIMIT=8_000_000;
    private PlaylistDownloader(){}
    public static String download(String address) throws Exception {
        if(!M3uParser.isUrl(address)) throw new IllegalArgumentException("Only HTTP/HTTPS URLs are supported");
        HttpURLConnection c=(HttpURLConnection)new URL(address).openConnection();
        c.setInstanceFollowRedirects(true);c.setConnectTimeout(12000);c.setReadTimeout(15000);
        c.setRequestProperty("Accept","audio/x-mpegurl,application/vnd.apple.mpegurl,text/plain,*/*");
        c.setRequestProperty("User-Agent","StreamBoard/1.0 (Android IPTV player)");
        try {
            int status=c.getResponseCode();
            if(status<200||status>=300)throw new Exception("Playlist HTTP "+status);
            if(c.getContentLengthLong()>LIMIT)throw new Exception("Playlist too large (8 MB limit)");
            try(InputStream input=c.getInputStream();ByteArrayOutputStream buf=new ByteArrayOutputStream()) {
                byte[] chunk=new byte[8192];int n;
                while((n=input.read(chunk))!=-1) {
                    if(buf.size()+n>LIMIT)throw new Exception("Playlist exceeds 8 MB limit");
                    buf.write(chunk,0,n);
                }
                return buf.toString(StandardCharsets.UTF_8.name()).replace("\ufeff","");
            }
        }finally {c.disconnect();}
    }
}
