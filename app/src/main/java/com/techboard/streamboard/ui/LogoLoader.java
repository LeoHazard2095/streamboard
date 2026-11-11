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
import java.lang.ref.WeakReference;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;

/** Small, bounded logo decoder: prevent scroll storms and oversized bitmap allocations. */
final class LogoLoader {
    private final Handler main=new Handler(Looper.getMainLooper());
    private final ThreadPoolExecutor pool=new ThreadPoolExecutor(2,2,0L,TimeUnit.MILLISECONDS,
        new LinkedBlockingQueue<>(48),new ThreadPoolExecutor.DiscardPolicy());
    // 3 MiB memory budget, not an arbitrary number of potentially large images.
    private final LruCache<String,Bitmap> cache=new LruCache<String,Bitmap>(3*1024*1024){
        @Override protected int sizeOf(String url,Bitmap bitmap){return bitmap.getByteCount();}
    };
    private final Map<String,List<Target>> inflight=new HashMap<>();
    private final LinkedHashMap<String,Long> failures=new LinkedHashMap<>();
    private volatile boolean closed=false;
    private static final class Target {
        final WeakReference<ImageView> image;
        final WeakReference<TextView> fallback;
        Target(ImageView image,TextView fallback){this.image=new WeakReference<>(image);this.fallback=new WeakReference<>(fallback);}
    }
    void bind(String url, ImageView image, TextView fallback){
        image.setTag(url);image.setImageDrawable(null);image.setVisibility(View.GONE);
        fallback.setVisibility(View.VISIBLE);
        if(closed||!M3uParser.isUrl(url))return;
        Bitmap existing; synchronized(cache){existing=cache.get(url);}
        if(existing!=null){show(url,image,fallback,existing);return;}
        synchronized(inflight){
            Long until=failures.get(url);
            if(until!=null && until>System.currentTimeMillis())return;
            List<Target> targets=inflight.get(url);
            if(targets!=null){if(targets.size()<90)targets.add(new Target(image,fallback));return;}
            if(inflight.size()>=50)return; // scrolling must never queue unbounded requests
            targets=new ArrayList<>();targets.add(new Target(image,fallback));inflight.put(url,targets);
        }
        // execute() plus bounded queue prevents memory growth on huge lists.
        if(pool.getQueue().remainingCapacity()==0){synchronized(inflight){inflight.remove(url);}return;}
        pool.execute(()->{
            Bitmap bitmap=fetch(url);
            main.post(()->{
                List<Target> targets;
                synchronized(inflight){
                    targets=inflight.remove(url);
                    if(bitmap==null){
                        failures.put(url,System.currentTimeMillis()+5*60*1000L);
                        while(failures.size()>500)failures.remove(failures.keySet().iterator().next());
                    }
                }
                if(closed)return;
                if(bitmap!=null){synchronized(cache){cache.put(url,bitmap);}}
                if(targets!=null && bitmap!=null)for(Target t:targets){
                    ImageView i=t.image.get();TextView f=t.fallback.get();
                    if(i!=null && f!=null)show(url,i,f,bitmap);
                }
            });
        });
    }
    private void show(String url,ImageView image,TextView fallback,Bitmap bitmap){
        if(closed||!url.equals(image.getTag()))return;
        image.setImageBitmap(bitmap);image.setVisibility(View.VISIBLE);fallback.setVisibility(View.GONE);
    }
    private Bitmap fetch(String url){
        HttpURLConnection c=null;
        try{
            c=(HttpURLConnection)new URL(url).openConnection();
            c.setConnectTimeout(5000);c.setReadTimeout(5000);
            c.setInstanceFollowRedirects(true);c.setRequestProperty("User-Agent","StreamBoard/1.1.1");
            if(c.getResponseCode()!=200||c.getContentLengthLong()>650000)return null;
            try(InputStream in=c.getInputStream();ByteArrayOutputStream out=new ByteArrayOutputStream()){
                byte[] buffer=new byte[8192];int n;
                while((n=in.read(buffer))!=-1){if(out.size()+n>650000)return null;out.write(buffer,0,n);}
                byte[] data=out.toByteArray();
                BitmapFactory.Options options=new BitmapFactory.Options();options.inJustDecodeBounds=true;
                BitmapFactory.decodeByteArray(data,0,data.length,options);
                if(options.outWidth<=0||options.outHeight<=0)return null;
                // First downsample at decode; otherwise a tiny compressed 4K poster can OOM Android.
                int sample=1;
                while(options.outWidth/sample>192||options.outHeight/sample>192)sample*=2;
                options.inJustDecodeBounds=false;options.inSampleSize=sample;
                Bitmap decoded=BitmapFactory.decodeByteArray(data,0,data.length,options);
                if(decoded==null)return null;
                Bitmap scaled=Bitmap.createScaledBitmap(decoded,96,96,true);
                if(decoded!=scaled)decoded.recycle();
                return scaled;
            }
        }catch(Exception | OutOfMemoryError ex){return null;}
        finally{if(c!=null)c.disconnect();}
    }
    void close(){closed=true;pool.shutdownNow();synchronized(inflight){inflight.clear();failures.clear();}
        synchronized(cache){cache.evictAll();}}
}
