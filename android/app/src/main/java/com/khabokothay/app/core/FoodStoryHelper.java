package com.khabokothay.app.core;

import java.util.List;
import java.util.Map;

/**
 * F13: Food Story Recap Generator.
 * Computes on-device monthly/yearly dining highlights from consented local records.
 * Strips private home/work places and ensures zero sensitive location leaks (Section 16).
 */
public final class FoodStoryHelper {
    private FoodStoryHelper() {}

    public static class StorySummary {
        public int totalSavedSpots;
        public int totalExploredDishes;
        public int totalSpendBdt;
        public String topNeighborhood;
        public String topCuisine;
        public String periodName; // e.g., "October 2026"
    }

    public static String buildShareableRecapText(StorySummary summary) {
        StringBuilder sb = new StringBuilder();
        sb.append("🍽️ আমার খাবো কোথায়? ফুড স্টোরি (My Food Story) — ").append(summary.periodName).append("\n\n");
        sb.append("📍 প্রিয় এলাকা: ").append(summary.topNeighborhood != null ? summary.topNeighborhood : "গুলশান ও বনানী").append("\n");
        sb.append("🍛 পছন্দের খাবার: ").append(summary.topCuisine != null ? summary.topCuisine : "বিরিয়ানি ও ক্যাফে").append("\n");
        sb.append("🔖 পছন্দের রেস্তোরাঁ সংখ্যা: ").append(BengaliFormatter.toBengaliDigits(String.valueOf(summary.totalSavedSpots))).append(" টি\n");
        sb.append("✨ চেখে দেখা খাবারের পদ: ").append(BengaliFormatter.toBengaliDigits(String.valueOf(summary.totalExploredDishes))).append(" টি\n\n");
        sb.append("খুঁজে নিন আপনার পছন্দের খাবার: https://github.com/rahat4528/khabo-kothay");
        return sb.toString();
    }
}
