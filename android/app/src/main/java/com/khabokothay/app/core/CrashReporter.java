package com.khabokothay.app.core;

import android.content.Context;
import android.os.Build;
import org.json.JSONObject;
import java.io.File;
import java.io.FileOutputStream;
import java.io.PrintWriter;
import java.io.StringWriter;

/**
 * F15: Consented, Sanitized Local Crash Capture.
 * Catches uncaught exceptions, strips PII/credentials, and caches crash dumps locally.
 * Reports are uploaded strictly upon user consent.
 */
public final class CrashReporter implements Thread.UncaughtExceptionHandler {
    private static final String PENDING_CRASH_FILE = "pending_crash_report.json";
    private final Context context;
    private final Thread.UncaughtExceptionHandler defaultHandler;

    public CrashReporter(Context context, Thread.UncaughtExceptionHandler defaultHandler) {
        this.context = context.getApplicationContext();
        this.defaultHandler = defaultHandler;
    }

    public static void install(Context context) {
        Thread.UncaughtExceptionHandler current = Thread.getDefaultUncaughtExceptionHandler();
        if (!(current instanceof CrashReporter)) {
            Thread.setDefaultUncaughtExceptionHandler(new CrashReporter(context, current));
        }
    }

    public static String sanitize(String text) {
        if (text == null) return "";
        return text
            .replaceAll("AIza[0-9A-Za-z\\-_]{20,}", "[REDACTED_API_KEY]")
            .replaceAll("(?i)(?:bearer|token|auth|key|secret)\\s*[:=\\s]\\s*['\"]?[0-9a-zA-Z\\-_]{8,}['\"]?", "[REDACTED_SECRET]")
            .replaceAll("\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}\\b", "[REDACTED_EMAIL]")
            .replaceAll("(?i)(?:lat|lng|latitude|longitude)\\s*[:=]\\s*[-+]?\\d+\\.\\d{3,}", "[COARSENED_LOCATION]");
    }

    @Override
    public void uncaughtException(Thread thread, Throwable throwable) {
        try {
            // Only store if consented
            if (ConsentManager.isCrashReportingConsented(context)) {
                StringWriter sw = new StringWriter();
                PrintWriter pw = new PrintWriter(sw);
                throwable.printStackTrace(pw);
                String stackTrace = sanitize(sw.toString());
                String message = sanitize(throwable.getMessage());

                JSONObject report = new JSONObject();
                report.put("errorCategory", throwable.getClass().getSimpleName());
                report.put("message", message);
                report.put("stackTrace", stackTrace);
                report.put("versionCode", 4);
                report.put("appVersion", "1.1.0");

                JSONObject deviceMeta = new JSONObject();
                deviceMeta.put("osVersion", "Android " + Build.VERSION.RELEASE + " (API " + Build.VERSION.SDK_INT + ")");
                deviceMeta.put("deviceModel", Build.MODEL);
                deviceMeta.put("manufacturer", Build.MANUFACTURER);
                report.put("deviceMeta", deviceMeta);

                File file = new File(context.getFilesDir(), PENDING_CRASH_FILE);
                FileOutputStream fos = new FileOutputStream(file);
                fos.write(report.toString().getBytes("UTF-8"));
                fos.close();
            }
        } catch (Exception e) {
            // Failsafe: never crash inside crash reporter
        } finally {
            if (defaultHandler != null) {
                defaultHandler.uncaughtException(thread, throwable);
            }
        }
    }

    public static boolean hasPendingCrash(Context context) {
        File file = new File(context.getApplicationContext().getFilesDir(), PENDING_CRASH_FILE);
        return file.exists() && file.length() > 0;
    }

    public static void clearPendingCrash(Context context) {
        File file = new File(context.getApplicationContext().getFilesDir(), PENDING_CRASH_FILE);
        if (file.exists()) {
            file.delete();
        }
    }
}
