package com.techboard.streamboard.ui;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.pm.ActivityInfo;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.media3.common.MediaItem;
import androidx.media3.common.MimeTypes;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.datasource.DefaultDataSource;
import androidx.media3.datasource.DefaultHttpDataSource;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory;
import androidx.media3.ui.PlayerView;

import com.techboard.streamboard.core.ChannelStore;
import com.techboard.streamboard.core.SourceSelector;
import com.techboard.streamboard.model.Channel;
import com.techboard.streamboard.model.ChannelGroup;

import java.net.URI;
import java.util.ArrayList;
import java.util.List;

/** Live HLS playback with bounded failover. No retry loops, DRM or sign-in bypass. */
public final class PlayerActivity extends Activity implements Player.Listener {
    private static final long STALL_MS=30000;
    private static final long WATCHDOG_MS=5000;
    private final Handler handler=new Handler(Looper.getMainLooper());
    private final List<Channel> feeds=new ArrayList<>();
    private final java.util.Set<String> attempted=new java.util.HashSet<>();
    private ChannelStore store;
    private ChannelGroup channel;
    private ExoPlayer player;
    private PlayerView video;
    private TextView title, status, sourceLabel;
    private int current=-1;
    private long bufferingSince=0;
    private boolean disposed=false;
    private final Runnable watchdog=new Runnable(){@Override public void run(){
        if(disposed||player==null)return;
        if(player.getPlayWhenReady() && player.getPlaybackState()==Player.STATE_BUFFERING
          && bufferingSince>0 && SystemClock.elapsedRealtime()-bufferingSince>=STALL_MS) {
            tryNext("Stream stalled for 30 seconds");
        }
        handler.postDelayed(this,WATCHDOG_MS);
    }};
    @Override public void onCreate(Bundle state){
        super.onCreate(state);getWindow().setFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON,WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        getWindow().setStatusBarColor(Ui.BG);getWindow().setNavigationBarColor(Ui.BG);
        store=new ChannelStore(this);
        String id=getIntent().getStringExtra("channel_id");channel=store.findGroup(id);
        if(channel==null||!channel.allowed||!store.categoryVisible(channel.category)){
            new AlertDialog.Builder(this).setTitle("Channel is not allowed").setMessage("Approve this channel and category first.")
                .setPositiveButton("Close",(d,w)->finish()).setCancelable(false).show();return;
        }
        feeds.addAll(channel.sources());
        String favorite=store.preferredSource(channel.id);
        if(!favorite.isEmpty())for(int i=0;i<feeds.size();i++)if(feeds.get(i).streamUrl.equals(favorite)){
            Channel selected=feeds.remove(i);feeds.add(0,selected);break;
        }
        setupViews();
        DefaultHttpDataSource.Factory http=new DefaultHttpDataSource.Factory()
            .setConnectTimeoutMs(12000).setReadTimeoutMs(15000)
            .setAllowCrossProtocolRedirects(true).setUserAgent("StreamBoardIPTV/1.0 Android");
        player=new ExoPlayer.Builder(this)
            .setMediaSourceFactory(new DefaultMediaSourceFactory(new DefaultDataSource.Factory(this,http)))
            .build();
        player.addListener(this);video.setPlayer(player);
        playIndex(0,"Starting stream",true);
        handler.postDelayed(watchdog,WATCHDOG_MS);
    }
    private void setupViews(){
        LinearLayout root=new LinearLayout(this);root.setOrientation(LinearLayout.VERTICAL);root.setBackgroundColor(Ui.BG);
        Ui.padding(root,this,12,9);setContentView(root);
        LinearLayout heading=new LinearLayout(this);heading.setOrientation(LinearLayout.HORIZONTAL);heading.setGravity(Gravity.CENTER_VERTICAL);
        Button back=Ui.button(this,"‹ Back",false);heading.addView(back);
        back.setOnClickListener(v->finish());
        title=Ui.text(this,channel.name,18,Ui.TEXT,true);
        LinearLayout.LayoutParams t=new LinearLayout.LayoutParams(0,-2,1);t.setMargins(Ui.dp(this,10),0,0,0);heading.addView(title,t);
        root.addView(heading);
        video=new PlayerView(this);video.setUseController(true);video.setShowBuffering(PlayerView.SHOW_BUFFERING_ALWAYS);
        LinearLayout.LayoutParams videoLp=new LinearLayout.LayoutParams(-1,0,1);
        videoLp.setMargins(0,Ui.dp(this,10),0,Ui.dp(this,10));root.addView(video,videoLp);
        status=Ui.text(this,"Connecting...",13,Ui.PRIMARY,true);root.addView(status);
        sourceLabel=Ui.text(this,"",12,Ui.MUTED,false);root.addView(sourceLabel);
        LinearLayout buttons=new LinearLayout(this);buttons.setGravity(Gravity.CENTER_VERTICAL);
        Button choose=Ui.button(this,"Choose source",false);
        Button next=Ui.button(this,"Try next source",true);
        LinearLayout.LayoutParams chooseLp=new LinearLayout.LayoutParams(0,Ui.dp(this,44),1);chooseLp.setMargins(0,Ui.dp(this,10),Ui.dp(this,8),0);
        buttons.addView(choose,chooseLp);
        LinearLayout.LayoutParams nextLp=new LinearLayout.LayoutParams(0,Ui.dp(this,44),1);nextLp.setMargins(0,Ui.dp(this,10),0,0);
        buttons.addView(next,nextLp);root.addView(buttons);
        choose.setOnClickListener(v->chooseSource());next.setOnClickListener(v->tryNext("Manual source switch"));
        TextView note=Ui.text(this,"Auto-switches on playback failure or prolonged buffering. It cannot verify that the expected show is on air.",11,Ui.MUTED,false);
        root.addView(note);note.setPadding(0,Ui.dp(this,7),0,0);
    }
    private void chooseSource(){
        String[] items=new String[feeds.size()];
        for(int i=0;i<feeds.size();i++)items[i]=(i==current?"▶ ":"")+feeds.get(i).sourceName+" · "+hostname(feeds.get(i).streamUrl);
        new AlertDialog.Builder(this).setTitle("Choose stream source")
            .setItems(items,(d,index)->{
                store.setPreferredSource(channel.id,feeds.get(index).streamUrl);
                playIndex(index,"User-selected source",true);
            }).setNeutralButton("Use automatic order",(d,w)->store.setPreferredSource(channel.id,"")).show();
    }
    private void playIndex(int index,String reason,boolean reset) {
        if(player==null||index<0||index>=feeds.size())return;
        if(reset)attempted.clear();
        Channel next=feeds.get(index);attempted.add(next.streamUrl);current=index;
        bufferingSince=SystemClock.elapsedRealtime();
        status.setText(reason+" · connecting...");
        sourceLabel.setText("Source "+(index+1)+"/"+feeds.size()+": "+next.sourceName+" ("+hostname(next.streamUrl)+")");
        MediaItem.Builder media=new MediaItem.Builder().setUri(next.streamUrl);
        if(next.streamUrl.toLowerCase(java.util.Locale.ROOT).contains(".m3u8"))media.setMimeType(MimeTypes.APPLICATION_M3U8);
        player.stop();player.setMediaItem(media.build());player.prepare();player.play();
    }
    private void tryNext(String reason){
        if(player==null)return;
        int candidate=SourceSelector.next(feeds,attempted,current);
        if(candidate>=0){playIndex(candidate,reason+" — trying alternative",false);return;}
        bufferingSince=0;
        status.setText("All "+feeds.size()+" source(s) failed or stalled. Try again later.");
        sourceLabel.setText("Last problem: "+reason);
        player.stop();
        new AlertDialog.Builder(this).setTitle("No working source")
            .setMessage("Every configured source has been tried once. Some streams may require membership, region access, or may be offline. You can retry a source manually.")
            .setPositiveButton("Choose source",(d,w)->chooseSource())
            .setNegativeButton("Close",null).show();
    }
    @Override public void onPlayerError(PlaybackException error){
        if(disposed)return;
        tryNext("Playback error " + error.errorCode);
    }
    @Override public void onPlaybackStateChanged(int state){
        if(state==Player.STATE_BUFFERING){
            if(bufferingSince==0)bufferingSince=SystemClock.elapsedRealtime();
            status.setText("Buffering...");
        } else if(state==Player.STATE_READY){
            bufferingSince=0;status.setText("Playing  •  "+(current+1)+" of "+feeds.size()+" sources");
        }else if(state==Player.STATE_ENDED){tryNext("Stream ended");}
    }
    @Override protected void onStart(){super.onStart();if(player!=null && player.getPlaybackState()!=Player.STATE_IDLE)player.play();}
    @Override protected void onStop(){
        super.onStop();if(player!=null)player.pause();
    }
    @Override protected void onDestroy(){
        disposed=true;handler.removeCallbacks(watchdog);
        if(player!=null){player.removeListener(this);player.release();player=null;}
        super.onDestroy();
    }
    private String hostname(String address){try {return new URI(address).getHost();}catch(Exception e){return "source";}}
}
