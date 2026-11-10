package com.techboard.streamboard.ui;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.Editable;
import android.text.TextWatcher;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.*;
import android.graphics.Color;
import android.widget.ImageView;
import android.widget.FrameLayout;
import android.graphics.Typeface;

import com.techboard.streamboard.core.ChannelStore;
import com.techboard.streamboard.core.M3uParser;
import com.techboard.streamboard.core.PlaylistDownloader;
import com.techboard.streamboard.core.StreamHealthChecker;
import com.techboard.streamboard.model.Channel;
import com.techboard.streamboard.model.ChannelGroup;
import com.techboard.streamboard.model.PlaylistSource;

import java.net.URI;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

/** Separate IPTV app. Newly imported channels never become playable until explicitly allowed. */
public class MainActivity extends Activity {
    private ChannelStore store;
    private final LogoLoader logos=new LogoLoader();
    private final ExecutorService pool=Executors.newFixedThreadPool(4);
    private final Handler ui=new Handler(Looper.getMainLooper());
    private LinearLayout main, panel;
    private TextView summary, activityMessage;
    private ListView listView;
    private ChannelAdapter channelAdapter;
    private Spinner categorySpinner;
    private final List<ChannelGroup> filtered=new ArrayList<>();
    private String tab="watch", category="All categories", search="";
    private final Map<String,String> playlistState=new ConcurrentHashMap<>();
    private final AtomicInteger running=new AtomicInteger();
    private boolean startedImport=false;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(Ui.BG);getWindow().setNavigationBarColor(Ui.BG);
        store=new ChannelStore(this);render();
        if(store.rawChannels().isEmpty()&&!store.sources().isEmpty())refreshAll();
    }
    @Override protected void onDestroy(){pool.shutdownNow();logos.close();super.onDestroy();}
    private LinearLayout column(){LinearLayout v=new LinearLayout(this);v.setOrientation(LinearLayout.VERTICAL);return v;}
    private LinearLayout row(){LinearLayout v=new LinearLayout(this);v.setOrientation(LinearLayout.HORIZONTAL);v.setGravity(Gravity.CENTER_VERTICAL);return v;}
    private LinearLayout.LayoutParams lp(int width,int height){return new LinearLayout.LayoutParams(width<0?width:Ui.dp(this,width),height<0?height:Ui.dp(this,height));}
    private void gap(LinearLayout p,int h){View v=new View(this);p.addView(v,lp(1,h));}
    private void render() {
        main=column();main.setBackgroundColor(Ui.BG);Ui.padding(main,this,16,13);setContentView(main);
        LinearLayout header=row();
        LinearLayout headText=column();
        TextView brand=Ui.text(this,"◉  StreamBoard",23,Ui.TEXT,true);
        headText.addView(brand);
        summary=Ui.text(this,"",12,Ui.MUTED,false);headText.addView(summary);
        header.addView(headText,new LinearLayout.LayoutParams(0,-2,1));
        TextView version=Ui.text(this,"v1.0.0",11,Ui.PRIMARY,true);header.addView(version);
        main.addView(header);gap(main,17);
        LinearLayout nav=row();
        String[] tabs={"Watch","Channels","Playlists"};String[] keys={"watch","manage","playlists"};
        for(int i=0;i<tabs.length;i++){
            final String selection=keys[i];Button b=Ui.button(this,tabs[i],tab.equals(selection));
            LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(0,Ui.dp(this,43),1);
            p.setMargins(Ui.dp(this,2),0,Ui.dp(this,2),0);nav.addView(b,p);
            b.setOnClickListener(v->{tab=selection;category="All categories";search="";render();});
        }
        main.addView(nav);gap(main,13);
        panel=column();panel.setBackground(Ui.bg(Ui.PANEL,16,this));Ui.padding(panel,this,12,12);
        main.addView(panel,new LinearLayout.LayoutParams(-1,0,1));
        if(tab.equals("watch"))renderWatch();
        else if(tab.equals("manage"))renderManage();
        else renderPlaylists();
        updateSummary();
    }
    private void updateSummary() {
        if(summary==null)return;
        List<ChannelGroup> groups=store.mergedChannels();
        long approved=groups.stream().filter(g->g.allowed).count();
        int alternatives=0;for(ChannelGroup g:groups)alternatives+=g.feeds.size();
        summary.setText(groups.size()+" channels  ·  "+approved+" approved  ·  "+alternatives+" sources");
    }
    private void heading(LinearLayout parent,String title,String detail) {
        parent.addView(Ui.text(this,title,20,Ui.TEXT,true));gap(parent,3);
        TextView desc=Ui.text(this,detail,12,Ui.MUTED,false);parent.addView(desc);gap(parent,12);
    }
    private void renderWatch() {
        heading(panel,"Live TV","Only allowed channels in visible categories appear here.");
        LinearLayout controls=row();
        Button test=Ui.button(this,"Check allowed streams",false);
        controls.addView(test);test.setOnClickListener(v->testAllowed());panel.addView(controls);gap(panel,8);
        renderFilters();
        setupList(false);
    }
    private void renderManage() {
        heading(panel,"Channel access","Approve individual channels. Hide whole categories independently.");
        TextView catLabel=Ui.text(this,"VISIBLE CATEGORIES  (tap to change)",11,Ui.MUTED,true);panel.addView(catLabel);gap(panel,7);
        HorizontalScrollView horizontal=new HorizontalScrollView(this);horizontal.setHorizontalScrollBarEnabled(false);
        LinearLayout categories=row();
        List<String> categoryNames=new ArrayList<>(allCategories());
        for(String name:categoryNames){
            boolean visible=store.categoryVisible(name);Button btn=Ui.button(this,(visible?"✓ ":"○ ")+name,visible);
            LinearLayout.LayoutParams p=lp(-2,38);p.setMargins(0,0,Ui.dp(this,7),0);
            categories.addView(btn,p);
            btn.setOnClickListener(v->{store.setCategoryVisible(name,!store.categoryVisible(name));render();});
        }
        horizontal.addView(categories);panel.addView(horizontal);gap(panel,10);
        renderFilters();
        LinearLayout bulk=row();Button allow=Ui.button(this,"Allow selected",false);Button block=Ui.button(this,"Block selected",false);
        LinearLayout.LayoutParams p1=new LinearLayout.LayoutParams(0,Ui.dp(this,43),1);p1.setMargins(0,0,Ui.dp(this,6),0);
        bulk.addView(allow,p1);bulk.addView(block,new LinearLayout.LayoutParams(0,Ui.dp(this,43),1));panel.addView(bulk);gap(panel,8);
        allow.setOnClickListener(v->bulkChange(true));block.setOnClickListener(v->bulkChange(false));
        setupList(true);
    }
    private List<String> allCategories() {
        TreeSet<String> cats=new TreeSet<>(String.CASE_INSENSITIVE_ORDER);
        for(ChannelGroup g:store.mergedChannels())cats.add(g.category);
        return new ArrayList<>(cats);
    }
    private void renderFilters() {
        LinearLayout filters=row();
        EditText field=new EditText(this);field.setSingleLine(true);field.setTextSize(14);field.setHint("Search channels");
        field.setTextColor(Ui.TEXT);field.setHintTextColor(Ui.MUTED);
        field.setBackground(Ui.bg(Ui.PANEL_ALT,10,this));Ui.padding(field,this,10,9);field.setText(search);
        LinearLayout.LayoutParams searchP=new LinearLayout.LayoutParams(0,Ui.dp(this,46),1);searchP.setMargins(0,0,Ui.dp(this,8),0);
        filters.addView(field,searchP);
        categorySpinner=new Spinner(this);
        List<String> options=new ArrayList<>();options.add("All categories");options.addAll(allCategories());
        ArrayAdapter<String> spinnerAdapter=new ArrayAdapter<String>(this,android.R.layout.simple_spinner_dropdown_item,options){
            @Override public View getView(int pos,View reused,ViewGroup parent){TextView t=(TextView)super.getView(pos,reused,parent);t.setTextColor(Ui.TEXT);t.setTextSize(12);return t;}
        };
        categorySpinner.setAdapter(spinnerAdapter);
        int selected=options.indexOf(category);categorySpinner.setSelection(Math.max(0,selected));
        filters.addView(categorySpinner,lp(130,46));panel.addView(filters);gap(panel,10);
        field.addTextChangedListener(new TextWatcher(){
            @Override public void beforeTextChanged(CharSequence s,int st,int count,int after){}
            @Override public void onTextChanged(CharSequence s,int st,int before,int count){search=s.toString();updateList();}
            @Override public void afterTextChanged(Editable e){}
        });
        categorySpinner.setOnItemSelectedListener(new android.widget.AdapterView.OnItemSelectedListener(){
            @Override public void onItemSelected(android.widget.AdapterView<?> parent,View view,int position,long id){category=options.get(position);updateList();}
            @Override public void onNothingSelected(android.widget.AdapterView<?> parent){}
        });
    }
    private void setupList(boolean manage) {
        channelAdapter=new ChannelAdapter(manage);
        listView=new ListView(this);listView.setDivider(null);listView.setCacheColorHint(Color.TRANSPARENT);
        listView.setBackgroundColor(Color.TRANSPARENT);listView.setAdapter(channelAdapter);
        listView.setOnItemClickListener((p,v,pos,id)->{
            if(pos>=filtered.size())return;
            ChannelGroup g=filtered.get(pos);
            if(manage)openChannelOptions(g);else openPlayer(g);
        });
        panel.addView(listView,new LinearLayout.LayoutParams(-1,0,1));
        TextView empty=Ui.text(this,manage?"No channels imported yet. Add a playlist and refresh it.":"No approved channels yet. Open Channels to select what you want to watch.",14,Ui.MUTED,false);
        empty.setGravity(Gravity.CENTER);Ui.padding(empty,this,14,15);
        panel.addView(empty,new LinearLayout.LayoutParams(-1,0,1));listView.setEmptyView(empty);
        updateList();
    }
    private void updateList() {
        if(channelAdapter==null||listView==null||!(tab.equals("watch")||tab.equals("manage")))return;
        filtered.clear();
        for(ChannelGroup group:store.mergedChannels()) {
            if(tab.equals("watch")&&(!group.allowed||!store.categoryVisible(group.category)))continue;
            if(!"All categories".equals(category)&&!category.equals(group.category))continue;
            if(!search.trim().isEmpty()){
                String q=search.toLowerCase(Locale.ROOT);
                if(!group.name.toLowerCase(Locale.ROOT).contains(q) && !group.category.toLowerCase(Locale.ROOT).contains(q))continue;
            }
            filtered.add(group);
        }
        channelAdapter.notifyDataSetChanged();
    }
    private void bulkChange(boolean value) {
        List<ChannelGroup> selected=new ArrayList<>(filtered);
        if(selected.isEmpty()){toast("No channels match the filters");return;}
        String action=value?"Allow":"Block";
        new AlertDialog.Builder(this).setTitle(action+" "+selected.size()+" channels?")
            .setMessage("This only changes the channels currently shown by your search/category filters.")
            .setNegativeButton("Cancel",null)
            .setPositiveButton(action,(d,w)->{
                for(ChannelGroup group:selected)store.setAllowed(group.id,value);
                updateSummary();updateList();toast("Updated "+selected.size()+" channels");
            }).show();
    }
    private void openChannelOptions(ChannelGroup group) {
        List<String> options=new ArrayList<>();
        options.add(group.allowed?"Block channel":"Allow channel");
        options.add("Play channel");options.add("Choose preferred source ("+group.feeds.size()+")");
        options.add("Check all sources");options.add("Change category");
        options.add(store.isFavorite(group)?"Remove favorite":"Add favorite");
        new AlertDialog.Builder(this).setTitle(group.name).setItems(options.toArray(new String[0]),(d,which)->{
            switch(which) {
                case 0:store.setAllowed(group.id,!group.allowed);updateSummary();updateList();break;
                case 1:openPlayer(group);break;
                case 2:choosePreferred(group);break;
                case 3:checkGroup(group);break;
                case 4:changeCategory(group);break;
                case 5:store.toggleFavorite(group);toast("Favorite updated");break;
            }
        }).setNegativeButton("Close",null).show();
    }
    private void choosePreferred(ChannelGroup group) {
        String[] names=new String[group.feeds.size()+1];names[0]="Automatic (first available)";
        for(int i=0;i<group.feeds.size();i++){
            Channel c=group.feeds.get(i);
            names[i+1]=c.sourceName+" — "+host(c.streamUrl)+" — "+c.status;
        }
        new AlertDialog.Builder(this).setTitle("Preferred source: "+group.name)
            .setSingleChoiceItems(names,-1,(dialog,which)->{
                store.setPreferredSource(group.id,which==0?"":group.feeds.get(which-1).streamUrl);
                toast("Source preference saved");dialog.dismiss();
            }).setNegativeButton("Cancel",null).show();
    }
    private void changeCategory(ChannelGroup group) {
        List<String> categories=new ArrayList<>(allCategories());
        for(String extra:new String[]{"Kids","News","Sports","Movies","Music","Entertainment","Documentary","Religious","International","Other"}){
            if(!categories.contains(extra))categories.add(extra);
        }
        Collections.sort(categories,String.CASE_INSENSITIVE_ORDER);
        new AlertDialog.Builder(this).setTitle("Category for "+group.name)
            .setItems(categories.toArray(new String[0]),(d,which)->{
                store.overrideCategory(group,categories.get(which));render();
            }).show();
    }
    private void openPlayer(ChannelGroup g) {
        ChannelGroup latest=store.findGroup(g.id);
        if(latest==null||!latest.allowed||!store.categoryVisible(latest.category)){
            new AlertDialog.Builder(this).setTitle("Channel not allowed")
                .setMessage("Enable this channel and its category in Channels before playing.")
                .setPositiveButton("OK",null).show();return;
        }
        Intent intent=new Intent(this,PlayerActivity.class);intent.putExtra("channel_id",latest.id);startActivity(intent);
    }
    private void renderPlaylists() {
        heading(panel,"Playlist sources","Import M3U URLs. Refresh sources independently; existing channels are kept if a refresh fails.");
        LinearLayout buttons=row();Button add=Ui.button(this,"+ Add playlist",true);
        Button refresh=Ui.button(this,"↻ Refresh all",false);
        LinearLayout.LayoutParams a=new LinearLayout.LayoutParams(0,Ui.dp(this,43),1);a.setMargins(0,0,Ui.dp(this,7),0);
        buttons.addView(add,a);buttons.addView(refresh,new LinearLayout.LayoutParams(0,Ui.dp(this,43),1));
        panel.addView(buttons);gap(panel,8);
        add.setOnClickListener(v->addPlaylistDialog());refresh.setOnClickListener(v->refreshAll());
        activityMessage=Ui.text(this,"Playlist links are user-supplied. Only use sources you are authorized to access.",12,Ui.MUTED,false);
        panel.addView(activityMessage);gap(panel,8);
        ScrollView scroll=new ScrollView(this);LinearLayout items=column();
        for(PlaylistSource source:store.sources()){
            LinearLayout card=column();card.setBackground(Ui.bg(Ui.PANEL_ALT,12,this));Ui.padding(card,this,12,10);
            card.addView(Ui.text(this,source.title,16,Ui.TEXT,true));
            long count=store.rawChannels().stream().filter(c->c.sourceId.equals(source.id)).count();
            card.addView(Ui.text(this,host(source.url)+"   ·   "+count+" entries",12,Ui.MUTED,false));
            String status=playlistState.getOrDefault(source.id,"");
            if(!status.isEmpty())card.addView(Ui.text(this,status,12,Ui.PRIMARY,false));
            gap(card,7);
            LinearLayout actions=row();Button update=Ui.button(this,"Refresh",false);Button remove=Ui.button(this,"Remove",false);
            actions.addView(update,lp(105,39));
            LinearLayout.LayoutParams rm=lp(105,39);rm.setMargins(Ui.dp(this,7),0,0,0);actions.addView(remove,rm);
            update.setOnClickListener(v->refreshSource(source));
            remove.setOnClickListener(v->new AlertDialog.Builder(this).setTitle("Remove "+source.title+"?")
                .setMessage("Only channels from this playlist will be removed. Approvals for other channels remain.")
                .setNegativeButton("Cancel",null).setPositiveButton("Remove",(d,w)->{store.removeSource(source.id);render();}).show());
            card.addView(actions);LinearLayout.LayoutParams margins=lp(-1,-2);margins.setMargins(0,0,0,Ui.dp(this,9));items.addView(card,margins);
        }
        scroll.addView(items);panel.addView(scroll,new LinearLayout.LayoutParams(-1,0,1));
    }
    private void addPlaylistDialog() {
        LinearLayout container=column();Ui.padding(container,this,18,10);
        EditText title=new EditText(this);title.setHint("Playlist name");title.setSingleLine(true);
        EditText url=new EditText(this);url.setHint("https://example.com/channels.m3u");url.setInputType(android.text.InputType.TYPE_TEXT_VARIATION_URI);url.setSingleLine(false);url.setMinLines(2);
        container.addView(title);container.addView(url);
        AlertDialog dlg=new AlertDialog.Builder(this).setTitle("Add M3U / M3U8 URL").setView(container)
            .setNegativeButton("Cancel",null).setPositiveButton("Add",null).create();
        dlg.setOnShowListener(v->dlg.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(btn->{
            String name=title.getText().toString().trim(), address=url.getText().toString().trim();
            if(!M3uParser.isUrl(address)){url.setError("Enter a valid HTTP or HTTPS URL");return;}
            if(name.isEmpty())name=host(address);
            if(!store.addSource(name,address)){toast("Already added or invalid URL");return;}
            PlaylistSource added=null;for(PlaylistSource s:store.sources())if(s.url.equals(address))added=s;
            dlg.dismiss();render();if(added!=null)refreshSource(added);
        }));dlg.show();
    }
    private void refreshAll() {
        List<PlaylistSource> sources=store.sources();
        if(sources.isEmpty()){toast("Add a playlist first");return;}
        if(startedImport&&running.get()>0){toast("Playlist refresh already running");return;}
        startedImport=true;for(PlaylistSource s:sources)refreshSource(s);
    }
    private void refreshSource(PlaylistSource source) {
        if("Downloading...".equals(playlistState.get(source.id)))return;
        playlistState.put(source.id,"Downloading...");running.incrementAndGet();updatePlaylistStatus();
        pool.submit(()->{
            try {
                String content=PlaylistDownloader.download(source.url);
                List<Channel> parsed=M3uParser.parse(content,source.id,source.title,source.url);
                if(parsed.isEmpty())throw new IllegalStateException("No valid channels found. Previous entries retained.");
                store.replaceSourceChannels(source.id,parsed);
                playlistState.put(source.id,"Imported "+parsed.size()+" entries");
            }catch(Exception error){playlistState.put(source.id,"Refresh failed: "+brief(error));}
            finally {
                running.decrementAndGet();ui.post(()->{
                    updateSummary();if(tab.equals("playlists"))render();else if(channelAdapter!=null)updateList();
                });
            }
        });
    }
    private void updatePlaylistStatus(){if(activityMessage!=null && tab.equals("playlists"))activityMessage.setText("Refreshing "+running.get()+" playlist(s)...");}
    private void checkGroup(ChannelGroup g) {
        toast("Checking "+g.feeds.size()+" source(s) in background");
        for(Channel feed:g.feeds)pool.submit(()->{
            StreamHealthChecker.check(feed);ui.post(()->{if(tab.equals("manage"))updateList();});
        });
    }
    private void testAllowed() {
        List<ChannelGroup> permitted=new ArrayList<>();for(ChannelGroup g:store.mergedChannels())if(g.allowed && store.categoryVisible(g.category))permitted.add(g);
        if(permitted.isEmpty()){toast("Approve channels first");return;}
        if(permitted.size()>250) {toast("Checking the first 250 approved channels");permitted=permitted.subList(0,250);}
        int total=permitted.size();AtomicInteger done=new AtomicInteger();
        for(ChannelGroup g:permitted){
            pool.submit(()->{
                for(Channel feed:g.feeds){StreamHealthChecker.check(feed);if("REACHABLE".equals(feed.status))break;}
                int finished=done.incrementAndGet();
                if(finished==total || finished%10==0) ui.post(()->{updateList();toast("Checked "+finished+" of "+total);});
            });
        }
        toast("Started checking "+total+" approved channels");
    }
    private String brief(Exception ex) {String e=ex.getMessage();return e==null?ex.getClass().getSimpleName():e.length()>115?e.substring(0,115):e;}
    private static String host(String url) {try {return new URI(url).getHost();}catch(Exception e){return "Source";}}
    private void toast(String s) {Toast.makeText(this,s,Toast.LENGTH_SHORT).show();}

    private class ChannelAdapter extends BaseAdapter {
        private final boolean manage;
        ChannelAdapter(boolean management){manage=management;}
        @Override public int getCount(){return filtered.size();}
        @Override public Object getItem(int pos){return filtered.get(pos);}
        @Override public long getItemId(int pos){return pos;}
        @Override public View getView(int pos,View convertView,ViewGroup parent) {
            ChannelGroup g=filtered.get(pos);
            LinearLayout card=row();Ui.padding(card,MainActivity.this,10,11);
            LinearLayout.LayoutParams b=lp(-1,-2);b.setMargins(0,0,0,Ui.dp(MainActivity.this,6));
            card.setBackground(Ui.bg(Ui.PANEL_ALT,12,MainActivity.this));
            TextView glyph=Ui.text(MainActivity.this,g.name.trim().isEmpty()?"TV":g.name.substring(0,Math.min(2,g.name.length())).toUpperCase(Locale.ROOT),14,Ui.PRIMARY,true);
            glyph.setGravity(Gravity.CENTER);glyph.setBackground(Ui.bg(Ui.PANEL,10,MainActivity.this));
            FrameLayout art=new FrameLayout(MainActivity.this);art.addView(glyph,new FrameLayout.LayoutParams(-1,-1));
            ImageView logo=new ImageView(MainActivity.this);logo.setScaleType(ImageView.ScaleType.FIT_CENTER);
            logo.setBackground(Ui.bg(Ui.PANEL,10,MainActivity.this));
            art.addView(logo,new FrameLayout.LayoutParams(-1,-1));
            card.addView(art,lp(47,48));logos.bind(g.logoUrl,logo,glyph);
            LinearLayout text=column();
            TextView name=Ui.text(MainActivity.this,g.name,15,Ui.TEXT,true);name.setMaxLines(2);text.addView(name);
            String desc=g.category+"  ·  "+g.feeds.size()+" source"+(g.feeds.size()==1?"":"s")
                +(g.language.isEmpty()?"":"  ·  "+g.language);
            TextView caption=Ui.text(MainActivity.this,desc,11,Ui.MUTED,false);caption.setMaxLines(2);text.addView(caption);
            if(!manage){String status="";for(Channel c:g.feeds)if("REACHABLE".equals(c.status)){status="Reachable ✓";break;}
                if(!status.isEmpty())text.addView(Ui.text(MainActivity.this,status,11,Ui.PRIMARY,false));}
            LinearLayout.LayoutParams textP=new LinearLayout.LayoutParams(0,-2,1);textP.setMargins(Ui.dp(MainActivity.this,10),0,Ui.dp(MainActivity.this,8),0);card.addView(text,textP);
            if(manage){Switch toggle=new Switch(MainActivity.this);toggle.setChecked(g.allowed);toggle.setOnCheckedChangeListener((v,on)->{
                store.setAllowed(g.id,on);g.allowed=on;updateSummary();
            });card.addView(toggle);}
            else {TextView arrow=Ui.text(MainActivity.this,"▶",19,Ui.PRIMARY,true);card.addView(arrow);}
            LinearLayout outer=column();outer.addView(card,b);return outer;
        }
    }
}
