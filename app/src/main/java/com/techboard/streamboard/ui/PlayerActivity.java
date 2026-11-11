package com.techboard.streamboard.ui;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.pm.ActivityInfo;
import android.content.res.Configuration;
import android.widget.FrameLayout;
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
import androidx.media3.common.Format;
import androidx.media3.ui.AspectRatioFrameLayout;
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
    private TextView title, status, sourceLabel, bandwidthLabel;
    private LinearLayout root, heading, actionRow, details;
    private FrameLayout videoFrame;
    private Button exitFull;
    private boolean fullscreen=false;
    private int heightLimit=0;
    private int current=-1;
    private long bufferingSince=0;
    private boolean disposed=false;
    private final Runnable watchdog=new Runnable(){@Override public void run(){
        if(disposed||player==null)return;
        if(player.getPlayWhenReady() && player.getPlaybackState()==Player.STATE_BUFFERING
          && bufferingSince>0 && SystemClock.elapsedRealtime()-bufferingSince>=STALL_MS) {
            tryNext("Stream stalled for 30 seconds");
        }
        if(bandwidthLabel!=null && player.getPlaybackState()==Player.STATE_READY){
            Format format=player.getVideoFormat();
            bandwidthLabel.setText((format==null||format.height<1?"Live":format.height+"p") +
                "  ·  "+(heightLimit==0?"Adaptive (Auto)":"Up to "+heightLimit+"p"));
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
            .setAllowCrossProtocolRedirects(true).setUserAgent("StreamBoardIPTV/1.1 Android");
        player=new ExoPlayer.Builder(this)
            .setMediaSourceFactory(new DefaultMediaSourceFactory(new DefaultDataSource.Factory(this,http)))
            .build();
        player.addListener(this);video.setPlayer(player);
        video.setResizeMode(AspectRatioFrameLayout.RESIZE_MODE_FIT);
        applyQuality(0);
        playIndex(0,"Starting stream",true);
        handler.postDelayed(watchdog,WATCHDOG_MS);
    }
    private void setupViews(){
        root=new LinearLayout(this);root.setOrientation(LinearLayout.VERTICAL);root.setBackgroundColor(Ui.BG);
        setContentView(root);
        heading=new LinearLayout(this);heading.setOrientation(LinearLayout.HORIZONTAL);heading.setGravity(Gravity.CENTER_VERTICAL);
        Ui.padding(heading,this,13,9);
        Button back=Ui.button(this,"‹ Back",false);heading.addView(back);
        back.setOnClickListener(v->finish());
        title=Ui.text(this,channel.name,18,Ui.TEXT,true);
        LinearLayout.LayoutParams titleLp=new LinearLayout.LayoutParams(0,-2,1);titleLp.setMargins(Ui.dp(this,10),0,0,0);
        heading.addView(title,titleLp);
        heading.addView(Ui.text(this,"● LIVE",11,Ui.PRIMARY,true));
        root.addView(heading);
        videoFrame=new FrameLayout(this);videoFrame.setBackgroundColor(android.graphics.Color.BLACK);
        video=new PlayerView(this);video.setUseController(true);
        video.setControllerAutoShow(true);video.setShowBuffering(PlayerView.SHOW_BUFFERING_ALWAYS);
        videoFrame.addView(video,new FrameLayout.LayoutParams(-1,-1));
        exitFull=Ui.button(this,"⤢ Exit fullscreen",true);
        FrameLayout.LayoutParams exit=new FrameLayout.LayoutParams(Ui.dp(this,142),Ui.dp(this,42),Gravity.RIGHT|Gravity.TOP);
        exit.setMargins(0,Ui.dp(this,10),Ui.dp(this,12),0);
        videoFrame.addView(exitFull,exit);exitFull.setVisibility(View.GONE);
        exitFull.setOnClickListener(v->setFullscreen(false));
        root.addView(videoFrame,new LinearLayout.LayoutParams(-1,0,1));
        status=Ui.text(this,"Connecting...",13,Ui.PRIMARY,true);
        sourceLabel=Ui.text(this,"",12,Ui.MUTED,false);
        bandwidthLabel=Ui.text(this,"Adaptive quality enabled",12,Ui.MUTED,false);
        details=new LinearLayout(this);details.setOrientation(LinearLayout.VERTICAL);Ui.padding(details,this,15,9);
        details.addView(status);details.addView(sourceLabel);details.addView(bandwidthLabel);root.addView(details);
        actionRow=new LinearLayout(this);actionRow.setGravity(Gravity.CENTER_VERTICAL);Ui.padding(actionRow,this,9,8);
        Button quality=Ui.button(this,"⚙  Quality",false);
        Button sources=Ui.button(this,"⇄  Sources",false);
        Button full=Ui.button(this,"⛶  Fullscreen",true);
        actionRow.addView(quality,buttonParams());actionRow.addView(sources,buttonParams());actionRow.addView(full,buttonParams());
        root.addView(actionRow);
        quality.setOnClickListener(v->chooseQuality());sources.setOnClickListener(v->chooseSource());
        full.setOnClickListener(v->setFullscreen(true));
        TextView note=Ui.text(this,"Adaptive bitrate when available · automatic source failover",11,Ui.MUTED,false);
        note.setGravity(Gravity.CENTER);note.setPadding(0,Ui.dp(this,3),0,Ui.dp(this,8));root.addView(note);
        note.setTag("player_note");
    }
    private LinearLayout.LayoutParams buttonParams(){
        LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(0,Ui.dp(this,45),1);
        p.setMargins(Ui.dp(this,4),0,Ui.dp(this,4),0);return p;
    }
    private void chooseQuality(){
        String[] names={"Auto · adaptive", "Up to 360p · low data", "Up to 480p", "Up to 720p", "Up to 1080p"};
        int[] limits={0,360,480,720,1080};
        int selected=0;for(int i=1;i<limits.length;i++)if(heightLimit==limits[i])selected=i;
        new AlertDialog.Builder(this).setTitle("Streaming quality")
            .setSingleChoiceItems(names,selected,(dialog,which)->{applyQuality(limits[which]);dialog.dismiss();})
            .setNegativeButton("Close",null).show();
    }
    private void applyQuality(int height){
        heightLimit=height;
        if(player==null)return;
        androidx.media3.common.TrackSelectionParameters.Builder track=player.getTrackSelectionParameters().buildUpon();
        track.setMaxVideoSize(Integer.MAX_VALUE,height==0?Integer.MAX_VALUE:height);
        player.setTrackSelectionParameters(track.build());
        if(bandwidthLabel!=null)bandwidthLabel.setText(height==0?"Auto quality · follows available HLS variants":"Resolution cap: "+height+"p");
    }
    private void setFullscreen(boolean full){
        fullscreen=full;
        if(full){
            getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE);
        }else{
            getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_VISIBLE);
            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED);
        }
        updateFullscreen();
    }
    private void updateFullscreen(){
        if(root==null)return;
        heading.setVisibility(fullscreen?View.GONE:View.VISIBLE);
        actionRow.setVisibility(fullscreen?View.GONE:View.VISIBLE);
        details.setVisibility(fullscreen?View.GONE:View.VISIBLE);
        for(int i=0;i<root.getChildCount();i++){
            View child=root.getChildAt(i);
            if("player_note".equals(child.getTag()))child.setVisibility(fullscreen?View.GONE:View.VISIBLE);
        }
        exitFull.setVisibility(fullscreen?View.VISIBLE:View.GONE);
        videoFrame.requestLayout();
        if(fullscreen)video.showController();
    }
    @Override public void onConfigurationChanged(Configuration config){super.onConfigurationChanged(config);updateFullscreen();}
    @Override public void onBackPressed(){if(fullscreen)setFullscreen(false);else super.onBackPressed();}
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
            status.setText("Buffering · Auto quality adjusting...");
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
