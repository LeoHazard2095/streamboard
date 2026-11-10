package com.techboard.streamboard.ui;

import android.content.Context;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.view.View;
import android.widget.Button;
import android.widget.TextView;

final class Ui {
    static final int BG=Color.rgb(11,18,32);
    static final int PANEL=Color.rgb(24,35,52);
    static final int PANEL_ALT=Color.rgb(33,46,65);
    static final int PRIMARY=Color.rgb(43,209,160);
    static final int TEXT=Color.rgb(240,245,250);
    static final int MUTED=Color.rgb(159,176,197);
    static final int RED=Color.rgb(248,113,113);
    static int dp(Context c,float dp) {return (int)(dp*c.getResources().getDisplayMetrics().density+0.5f);}
    static GradientDrawable bg(int color,int radius,Context c) {
        GradientDrawable d=new GradientDrawable();d.setColor(color);d.setCornerRadius(dp(c,radius));return d;
    }
    static TextView text(Context c,String s,int sp,int color,boolean bold) {
        TextView v=new TextView(c);v.setText(s);v.setTextSize(sp);v.setTextColor(color);
        if(bold)v.setTypeface(Typeface.DEFAULT,Typeface.BOLD);
        return v;
    }
    static Button button(Context c,String label,boolean primary) {
        Button b=new Button(c);b.setAllCaps(false);b.setText(label);b.setTextSize(13);
        b.setTextColor(primary?BG:TEXT);b.setBackground(bg(primary?PRIMARY:PANEL_ALT,12,c));
        b.setPadding(dp(c,12),dp(c,5),dp(c,12),dp(c,5));return b;
    }
    static void padding(View v,Context c,int x,int y) {v.setPadding(dp(c,x),dp(c,y),dp(c,x),dp(c,y));}
}
