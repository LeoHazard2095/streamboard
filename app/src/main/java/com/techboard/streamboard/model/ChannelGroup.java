package com.techboard.streamboard.model;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/** A display channel can have several independently playable stream sources. */
public final class ChannelGroup {
    public final String id;
    public final List<Channel> feeds = new ArrayList<>();
    private final java.util.Set<String> feedUrls = new java.util.HashSet<>();
    public String name = "";
    public String category = "Other";
    public String language = "";
    public String country = "";
    public String logoUrl = "";
    public boolean allowed = false;

    public ChannelGroup(String id, Channel first) {
        this.id = id;
        add(first);
    }
    public void add(Channel feed) {
        if (!feedUrls.add(feed.streamUrl)) return;
        feeds.add(feed);
        if (name.isEmpty() || feed.name.length() > name.length() && feed.name.length() < 55) name = feed.name;
        if ("Other".equals(category) && !"Other".equals(feed.category)) category = feed.category;
        if (language.isEmpty() && !feed.language.isEmpty()) language = feed.language;
        if (country.isEmpty() && !feed.country.isEmpty()) country = feed.country;
        if (logoUrl.isEmpty() && !feed.logoUrl.isEmpty()) logoUrl = feed.logoUrl;
    }
    public List<Channel> sources() {return Collections.unmodifiableList(feeds);}
}
