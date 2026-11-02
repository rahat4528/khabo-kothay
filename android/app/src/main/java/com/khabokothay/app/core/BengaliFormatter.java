package com.khabokothay.app.core;

public final class BengaliFormatter {
    private static final char[] BANGLA_DIGITS = {
        '\u09E6', '\u09E7', '\u09E8', '\u09E9', '\u09EA',
        '\u09EB', '\u09EC', '\u09ED', '\u09EE', '\u09EF'
    };

    private BengaliFormatter() {}

    public static String toBengaliDigits(String input) {
        return toBanglaDigits(input);
    }

    public static String toBengaliDigits(long number) {
        return toBanglaDigits(number);
    }

    public static String toBanglaDigits(long number) {
        return toBanglaDigits(String.valueOf(number));
    }

    public static String toBanglaDigits(String input) {
        if (input == null) return "";
        StringBuilder sb = new StringBuilder(input.length());
        for (int i = 0; i < input.length(); i++) {
            char c = input.charAt(i);
            if (c >= '0' && c <= '9') {
                sb.append(BANGLA_DIGITS[c - '0']);
            } else {
                sb.append(c);
            }
        }
        return sb.toString();
    }

    public static String formatBdt(long amount, boolean useBanglaDigits) {
        String numStr = String.valueOf(amount);
        return useBanglaDigits ? "৳" + toBanglaDigits(numStr) : "৳" + numStr;
    }
}
