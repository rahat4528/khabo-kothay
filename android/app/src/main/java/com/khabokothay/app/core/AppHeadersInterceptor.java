package com.khabokothay.app.core;

import android.content.Context;
import androidx.annotation.NonNull;
import java.io.IOException;
import java.util.UUID;
import okhttp3.Interceptor;
import okhttp3.Request;
import okhttp3.Response;

/**
 * Injects required application headers into every HTTP request (Section 3).
 * Intercepts HTTP 426 (UPGRADE_REQUIRED) to trigger update prompts.
 */
public final class AppHeadersInterceptor implements Interceptor {
    public interface UpgradeRequiredListener {
        void onUpgradeRequired(String message, String downloadUrl);
    }

    private final Context context;
    private static UpgradeRequiredListener upgradeListener = null;

    public AppHeadersInterceptor(Context context) {
        this.context = context.getApplicationContext();
    }

    public static void setUpgradeRequiredListener(UpgradeRequiredListener listener) {
        upgradeListener = listener;
    }

    @NonNull
    @Override
    public Response intercept(@NonNull Chain chain) throws IOException {
        Request original = chain.request();
        String requestId = "req-" + UUID.randomUUID().toString().substring(0, 8);
        String installId = InstallId.get(context);

        Request.Builder builder = original.newBuilder()
            .header("X-App-Version-Code", "4")
            .header("X-App-Version-Name", "1.1.0")
            .header("X-App-Channel", "stable")
            .header("X-Install-Id", installId)
            .header("X-Request-Id", requestId);

        Response response = chain.proceed(builder.build());

        if (response.code() == 426) {
            // Server returned HTTP 426 UPGRADE_REQUIRED
            if (upgradeListener != null) {
                upgradeListener.onUpgradeRequired(
                    "This version of the app is no longer supported.",
                    "https://github.com/rahat4528/khabo-kothay/releases/latest"
                );
            }
        }

        return response;
    }
}
