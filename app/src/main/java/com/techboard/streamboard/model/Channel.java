package com.techboard.streamboard.model;

public class Channel {
    public String sourceId = "";
    public String sourceName = "";
    public String name = "";
    public String streamUrl = "";
    public String logoUrl = "";
    public String tvgId = "";
    public String language = "";
    public String country = "";
    public String group = "";
    public String category = "Other";
    public volatile String status = "NOT_CHECKED";
    public volatile String statusDetail = "Not tested";
    public volatile long checkedAt = 0L;

    public String key() { return streamUrl.trim(); }
    public String label() { return name == null || name.trim().isEmpty() ? "Unnamed channel" : name; }
}
