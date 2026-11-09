package com.khabokothay.app.core;

import org.junit.Test;
import static org.junit.Assert.*;

public class UpdateCheckerTest {

    @Test
    public void evaluateUpdate_returnsNoUpdate_whenInstalledVersionIsCurrentOrNewer() {
        assertEquals(UpdateChecker.UpdateType.NO_UPDATE, UpdateChecker.evaluateUpdate(3, 3, 1));
        assertEquals(UpdateChecker.UpdateType.NO_UPDATE, UpdateChecker.evaluateUpdate(4, 3, 1));
    }

    @Test
    public void evaluateUpdate_returnsSoftUpdate_whenNewerVersionExistsAndInstalledMeetsMinimum() {
        assertEquals(UpdateChecker.UpdateType.SOFT_UPDATE, UpdateChecker.evaluateUpdate(3, 4, 1));
    }

    @Test
    public void evaluateUpdate_returnsForcedUpdate_whenInstalledVersionIsBelowMinimum() {
        assertEquals(UpdateChecker.UpdateType.FORCED_UPDATE, UpdateChecker.evaluateUpdate(2, 5, 3));
    }

    @Test
    public void isApprovedDownloadUrl_validatesHostAndScheme() {
        assertTrue(UpdateChecker.isApprovedDownloadUrl("https://github.com/rahat4528/khabo-kothay/releases/download/v4/app.apk"));
        assertTrue(UpdateChecker.isApprovedDownloadUrl("https://khabo-kothay-backend.onrender.com/apk/latest.apk"));
        assertFalse(UpdateChecker.isApprovedDownloadUrl("http://github.com/insecure.apk"));
        assertFalse(UpdateChecker.isApprovedDownloadUrl("https://phishing.site/app.apk"));
        assertFalse(UpdateChecker.isApprovedDownloadUrl(""));
        assertFalse(UpdateChecker.isApprovedDownloadUrl(null));
    }
}
