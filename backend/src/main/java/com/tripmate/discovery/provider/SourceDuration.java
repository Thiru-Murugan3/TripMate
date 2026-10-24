package com.tripmate.discovery.provider;

/** Reads unambiguous OSM hours:minutes[:seconds]; bare numbers are ambiguous. */
public final class SourceDuration {
    private SourceDuration() {}
    public static Integer minutes(String value) {
        if(value==null || !value.trim().matches("[0-9]{1,3}:[0-5][0-9](:[0-5][0-9])?")) return null;
        String[] parts=value.trim().split(":");
        int minutes=Integer.parseInt(parts[0])*60+Integer.parseInt(parts[1]);
        if(parts.length==3 && Integer.parseInt(parts[2])>0) minutes++;
        return minutes>0 && minutes<=10080 ? minutes : null;
    }
}
