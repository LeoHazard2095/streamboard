package com.techboard.streamboard.ui;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.pm.ActivityInfo;
import android.content.res.Configuration;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.media3.common.MediaItem;
import androidx.media3.common.MimeTypes;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.common.TrackSelectionParameters;
import androidx.media3.datasource.DefaultDataSource;
import androidx.media3.datasource.DefaultHttpDataSource;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory;
import androidx.media3.ui.AspectRatioFrameLayout;
import androidx.media3.ui.PlayerView;

import com.techboard.streamboard.core.ChannelStore;
import com.techboard.streamboard.core.SourceSelector;
import com.techboard.streamboard.model.Channel;
import com.techboard.streamboard.model.ChannelGroup;

import java.net.URI;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/** One lazily-created ExoPlayer shared by all channel tabs. Never re-created by search or navigation. */
final class InlinePlayer implements Player.Listener {
    interface Fullscreen { void change(boolean on); }
    interface StepChannel { void move(int direction); }
    private static final long STALL_MS=30000L;
    private final Activity activity;
    private final ChannelStore store;
    private final LinearLayout mount;
    private final Fullscreen fullscreenCallback;
    private final StepChannel stepCallback;
    private final Handler handler=new Handler(Looper.getMainLooper());
    private final List<Channel> feeds=new ArrayList<>();
    private final Set<String> attempted=new HashSet<>();
    private final LinearLayout controls;
    private final FrameLayout frame;
    private final PlayerView view;
    private final TextView heading, status, resolution;
    private final Button fullscreenButton;
    private final Button exitButton;
    private ExoPlayer player;
    private String channelId="";
    private int feedIndex=-1, qualityCap=0;
    private long bufferingSince=0;
    private boolean isFullscreen=false, destroyed=false, resumeOnForeground=false;
    private final Runnable stallWatchdog=new Runnable(){@Override public void run(){
        if(destroyed)return;
        if(player!=null && player.getPlayWhenReady() && player.getPlaybackState()==Player.STATE_BUFFERING
            && bufferingSince>0 && SystemClock.elapsedRealtime()-bufferingSince>=STALL_MS){
            bufferingSince=0;nextSource("Playback stalled");
        }
        if(player!=null && player.getPlaybackState()==Player.STATE_READY){
            androidx.media3.common.Format f=player.getVideoFormat();
            resolution.setText((f!=null && f.height>0?f.height+"p":"Live")
                +(qualityCap==0?" · Auto quality":" · ≤"+qualityCap+"p"));
        }
        handler.postDelayed(this,5000);
    }};

    InlinePlayer(Activity activity,ChannelStore store,LinearLayout mount,Fullscreen fullscreen,StepChannel steps){
        this.activity=activity;this.store=store;this.mount=mount;
        this.fullscreenCallback=fullscreen;this.stepCallback=steps;
        mount.setBackground(Ui.bg(Ui.PANEL,13,activity));
        frame=new FrameLayout(activity);frame.setBackgroundColor(android.graphics.Color.BLACK);
        view=new PlayerView(activity);view.setUseController(true);
        view.setShowBuffering(PlayerView.SHOW_BUFFERING_ALWAYS);
        view.setResizeMode(AspectRatioFrameLayout.RESIZE_MODE_FIT);
        frame.addView(view,new FrameLayout.LayoutParams(-1,-1));
        exitButton=Ui.button(activity,"Exit fullscreen",true);
        FrameLayout.LayoutParams exit=new FrameLayout.LayoutParams(Ui.dp(activity,145),Ui.dp(activity,43),Gravity.TOP|Gravity.RIGHT);
        exit.setMargins(0,Ui.dp(activity,9),Ui.dp(activity,9),0);
        frame.addView(exitButton,exit);exitButton.setVisibility(View.GONE);
        exitButton.setOnClickListener(v->fullscreenCallback.change(false));
        int dpWidth=activity.getResources().getConfiguration().screenWidthDp;
        int videoHeight=Math.max(142,Math.min(255,(dpWidth-30)*9/16));
        mount.addView(frame,new LinearLayout.LayoutParams(-1,Ui.dp(activity,videoHeight)));
        LinearLayout now=new LinearLayout(activity);now.setGravity(Gravity.CENTER_VERTICAL);
        Ui.padding(now,activity,12,8);
        LinearLayout titles=new LinearLayout(activity);titles.setOrientation(LinearLayout.VERTICAL);
        heading=Ui.text(activity,"Choose a channel",14,Ui.TEXT,true);heading.setSingleLine(true);
        status=Ui.text(activity,"Ready",11,Ui.MUTED,false);status.setSingleLine(true);
        titles.addView(heading);titles.addView(status);
        now.addView(titles,new LinearLayout.LayoutParams(0,-2,1));
        resolution=Ui.text(activity,"Auto quality",11,Ui.PRIMARY,true);
        now.addView(resolution);
        mount.addView(now);
        controls=new LinearLayout(activity);controls.setGravity(Gravity.CENTER_VERTICAL);
        Ui.padding(controls,activity,7,4);
        Button prev=Ui.button(activity,"‹",false),next=Ui.button(activity,"›",false);
        Button sources=Ui.button(activity,"Sources",false),quality=Ui.button(activity,"Auto",false);
        fullscreenButton=Ui.button(activity,"⛶",true);
        for(Button b:new Button[]{prev,next,sources,quality,fullscreenButton}){
            LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(0,Ui.dp(activity,38),1);
            p.setMargins(Ui.dp(activity,2),0,Ui.dp(activity,2),0);
            controls.addView(b,p);
        }
        mount.addView(controls);
        prev.setOnClickListener(v->stepCallback.move(-1));next.setOnClickListener(v->stepCallback.move(1));
        sources.setOnClickListener(v->showSources());quality.setOnClickListener(v->showQuality());
        fullscreenButton.setOnClickListener(v->fullscreenCallback.change(true));
    }
    String currentId(){return channelId;}
    boolean hasChannel(){return !channelId.isEmpty();}
    void play(ChannelGroup g){
        if(destroyed||g==null||!g.allowed||!store.categoryVisible(g.category))return;
        channelId=g.id;
        heading.setText(g.name);mount.setVisibility(View.VISIBLE);
        feeds.clear();feeds.addAll(g.sources());attempted.clear();
        String preferred=store.preferredSource(g.id);
        if(!preferred.isEmpty())for(int i=0;i<feeds.size();i++)if(preferred.equals(feeds.get(i).streamUrl)){
            Channel selected=feeds.remove(i);feeds.add(0,selected);break;
        }
        if(feeds.isEmpty()){status.setText("No streams available");return;}
        try{ensurePlayer();}
        catch(RuntimeException failure){
            status.setText("Player could not start: "+failure.getClass().getSimpleName());
            return;
        }
        playSource(0,"Connecting",true);
    }
    private void ensurePlayer(){
        if(player!=null)return;
        DefaultHttpDataSource.Factory http=new DefaultHttpDataSource.Factory()
            .setConnectTimeoutMs(12000).setReadTimeoutMs(15000)
            .setAllowCrossProtocolRedirects(true).setUserAgent("StreamBoard-IPTV/1.1.1 Android");
        player=new ExoPlayer.Builder(activity)
            .setMediaSourceFactory(new DefaultMediaSourceFactory(new DefaultDataSource.Factory(activity,http)))
            .build();
        player.addListener(this);view.setPlayer(player);
        setQuality(0);handler.postDelayed(stallWatchdog,5000);
    }
    private void playSource(int position,String reason,boolean reset){
        if(player==null||position<0||position>=feeds.size())return;
        if(reset)attempted.clear();
        Channel feed=feeds.get(position);attempted.add(feed.streamUrl);feedIndex=position;
        bufferingSince=SystemClock.elapsedRealtime();
        status.setText(reason+" · "+feed.sourceName+" ("+(position+1)+"/"+feeds.size()+")");
        MediaItem.Builder item=new MediaItem.Builder().setUri(feed.streamUrl);
        if(feed.streamUrl.toLowerCase(Locale.ROOT).contains(".m3u8"))item.setMimeType(MimeTypes.APPLICATION_M3U8);
        player.stop();player.setMediaItem(item.build());player.prepare();player.play();
    }
    private void nextSource(String reason){
        if(player==null||destroyed)return;
        int candidate=SourceSelector.next(feeds,attempted,feedIndex);
        if(candidate>=0){playSource(candidate,reason+" · alternate",false);return;}
        bufferingSince=0;status.setText("All sources unavailable · Select Sources to retry");player.stop();
    }
    private void showSources(){
        if(feeds.isEmpty())return;
        String[] names=new String[feeds.size()+1];names[0]="Automatic source order";
        for(int i=0;i<feeds.size();i++){
            String domain="";try{domain=new URI(feeds.get(i).streamUrl).getHost();}catch(Exception ignored){}
            names[i+1]=(i==feedIndex?"▶ ":"")+feeds.get(i).sourceName+" · "+domain;
        }
        new AlertDialog.Builder(activity).setTitle("Source for "+heading.getText())
            .setItems(names,(d,which)->{
                if(which==0){store.setPreferredSource(channelId,"");playSource(0,"Auto source",true);}
                else{store.setPreferredSource(channelId,feeds.get(which-1).streamUrl);
                    playSource(which-1,"Selected source",true);}
            }).setNegativeButton("Cancel",null).show();
    }
    private void showQuality(){
        final int[] caps={0,360,480,720,1080};
        String[] labels={"Auto adaptive","Up to 360p","Up to 480p","Up to 720p","Up to 1080p"};
        int idx=0;for(int i=1;i<caps.length;i++)if(caps[i]==qualityCap)idx=i;
        new AlertDialog.Builder(activity).setTitle("Video quality")
            .setSingleChoiceItems(labels,idx,(d,i)->{setQuality(caps[i]);d.dismiss();})
            .setNegativeButton("Cancel",null).show();
    }
    private void setQuality(int cap){
        qualityCap=cap;if(player==null)return;
        TrackSelectionParameters.Builder params=player.getTrackSelectionParameters().buildUpon();
        params.setMaxVideoSize(Integer.MAX_VALUE,cap==0?Integer.MAX_VALUE:cap);
        player.setTrackSelectionParameters(params.build());
        resolution.setText(cap==0?"Auto quality":"≤"+cap+"p");
    }
    @Override public void onPlayerError(PlaybackException error){
        if(!destroyed)nextSource("Error "+error.errorCode);
    }
    @Override public void onPlaybackStateChanged(int state){
        if(destroyed)return;
        if(state==Player.STATE_READY){bufferingSince=0;
            status.setText("● Playing · "+feeds.get(Math.max(0,feedIndex)).sourceName);
        }else if(state==Player.STATE_BUFFERING){
            if(bufferingSince==0)bufferingSince=SystemClock.elapsedRealtime();
            status.setText("Buffering · adjusting quality…");
        }else if(state==Player.STATE_ENDED)nextSource("Stream ended");
    }
    void revalidate(){
        if(channelId.isEmpty())return;
        ChannelGroup g=store.findGroup(channelId);
        if(g==null||!g.allowed||!store.categoryVisible(g.category)){
            if(player!=null)player.stop();channelId="";
            mount.setVisibility(View.GONE);if(isFullscreen)fullscreenCallback.change(false);
        }
    }
    void onConfigurationChanged(boolean fullscreen){
        isFullscreen=fullscreen;
        controls.setVisibility(fullscreen?View.GONE:View.VISIBLE);
        exitButton.setVisibility(fullscreen?View.VISIBLE:View.GONE);
        // The title/status line belongs to the embedded player, not fullscreen video.
        View now=mount.getChildAt(1);if(now!=null)now.setVisibility(fullscreen?View.GONE:View.VISIBLE);
        LinearLayout.LayoutParams p;
        if(fullscreen)p=new LinearLayout.LayoutParams(-1,0,1);
        else{
            int dp=activity.getResources().getConfiguration().screenWidthDp;
            p=new LinearLayout.LayoutParams(-1,Ui.dp(activity,Math.max(142,Math.min(255,(dp-30)*9/16))));
        }
        frame.setLayoutParams(p);
        activity.getWindow().getDecorView().setSystemUiVisibility(fullscreen?
            View.SYSTEM_UI_FLAG_FULLSCREEN|View.SYSTEM_UI_FLAG_HIDE_NAVIGATION|View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
            |View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN|View.SYSTEM_UI_FLAG_LAYOUT_STABLE:View.SYSTEM_UI_FLAG_VISIBLE);
        activity.setRequestedOrientation(fullscreen?ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE:
            ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED);
    }
    void pauseForBackground(){
        if(player==null)return;
        resumeOnForeground=player.getPlayWhenReady();player.pause();
    }
    void resumeForeground(){if(player!=null&&resumeOnForeground){resumeOnForeground=false;player.play();}}
    void release(){
        destroyed=true;handler.removeCallbacksAndMessages(null);
        if(player!=null){player.removeListener(this);view.setPlayer(null);player.release();player=null;}
    }
}
