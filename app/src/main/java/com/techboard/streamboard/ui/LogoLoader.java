package com.techboard.streamboard.ui;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.Handler;
import android.os.Looper;
import android.util.LruCache;
import android.view.View;
import android.widget.ImageView;
import android.widget.TextView;

import com.techboard.streamboard.core.M3uParser;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Bounded, asynchronous logo cache. A failed source leaves the text tile visible. */
final class LogoLoader {
    private final Handler main=new Handler(Looper.getMainLooper());
    private final ExecutorService pool=Executors.newFixedThreadPool(3);
    private final LruCache<String,Bitmap> cache=new LruCache<>(60);
    private volatile boolean closed=false;
    void bind(String url, ImageView image,TextView fallback){
        image.setTag(url);image.setVisibility(View.GONE);fallback.setVisibility(View.VISIBLE);
        if(!M3uParser.isUrl(url))return;
        Bitmap saved; synchronized(cache){saved=cache.get(url);}
        if(saved!=null){show(url,image,fallback,saved);return;}
        pool.submit(()->{
            Bitmap bitmap=fetch(url);
            if(bitmap==null||closed)return;
            synchronized(cache){cache.put(url,bitmap);}
            main.post(()->show(url,image,fallback,bitmap));
        });
    }
    private void show(String url,ImageView image,TextView fallback,Bitmap bitmap){
        if(closed||!url.equals(image.getTag()))return;
        image.setImageBitmap(bitmap);image.setVisibility(View.VISIBLE);fallback.setVisibility(View.GONE);
    }
    private Bitmap fetch(String url) {
        HttpURLConnection c=null;
        try {
            c=(HttpURLConnection)new URL(url).openConnection();c.setConnectTimeout(6000);c.setReadTimeout(6000);
            c.setInstanceFollowRedirects(true);c.setRequestProperty("User-Agent","StreamBoard-IPTV/1.0");
            if(c.getResponseCode()!=200||c.getContentLengthLong()>700000)return null;
            try(InputStream in=c.getInputStream();ByteArrayOutputStream out=new ByteArrayOutputStream()){
                byte[] buf=new byte[4096];int n;
                while((n=in.read(buf))>=0){if(out.size()+n>700000)return null;out.write(buf,0,n);}
                byte[] bytes=out.toByteArray();
                BitmapFactory.Options options=new BitmapFactory.Options();options.inJustDecodeBounds=true;
                BitmapFactory.decodeByteArray(bytes,0,bytes.length,options);
                if(options.outWidth<1||options.outHeight<1)return null;
                options.inSampleSize=Math.max(1,Math.max(options.outWidth,options.outHeight)/150);
                options.inJustDecodeBounds=false;
                Bitmap decoded=BitmapFactory.decodeByteArray(bytes,0,bytes.length,options);
                if(decoded==null)return null;
                Bitmap resized=Bitmap.createScaledBitmap(decoded,96,96,true);
                if(decoded!=resized)decoded.recycle();
                return resized;
            }
        }catch(Exception e){return null;}
        finally{if(c!=null)c.disconnect();}
    }
    void close(){closed=true;pool.shutdownNow();}
}
