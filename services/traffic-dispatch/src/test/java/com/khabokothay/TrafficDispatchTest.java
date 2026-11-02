package com.khabokothay;

import com.khabokothay.geofence.DhakaGeofenceManager;
import com.khabokothay.model.Coordinates;
import com.khabokothay.model.TransitMode;
import com.khabokothay.model.TripQuote;
import com.khabokothay.traffic.TrafficDispatchEngine;
import com.khabokothay.traffic.TrafficDispatchEngine.WeatherCondition;

import java.time.LocalTime;
import java.util.List;

/**
 * Self-contained unit testing suite for Java Traffic & Geofencing engine.
 */
public class TrafficDispatchTest {

    private static int testsPassed = 0;
    private static int testsTotal = 0;

    public static void main(String[] args) {
        System.out.println("Running Java Traffic Dispatch & Geofencing Unit Tests...");

        testCoordinatesDistanceAndBearing();
        testCoordinatesValidation();
        testGeofenceRayCasting();
        testRickshawMunicipalRestrictions();
        testMohakhaliGeofenceAndFlyoverRestriction();
        testExpandedDhakaZones();
        testPeakHourSurgeCurve();
        testMonsoonSurgeImpact();
        testMultiModeDispatchQuote();

        System.out.printf("\nResult: %d/%d tests passed successfully.\n", testsPassed, testsTotal);
        if (testsPassed != testsTotal) {
            System.exit(1);
        }
    }

    private static void assertTrue(String testName, boolean condition) {
        testsTotal++;
        if (condition) {
            testsPassed++;
            System.out.println("  [PASS] " + testName);
        } else {
            System.err.println("  [FAIL] " + testName);
            throw new AssertionError("Test assertion failed: " + testName);
        }
    }

    private static void testCoordinatesDistanceAndBearing() {
        Coordinates banani = new Coordinates(23.7915, 90.4030);
        Coordinates gulshan2 = new Coordinates(23.7937, 90.4150);

        double dist = banani.distanceToKm(gulshan2);
        assertTrue("Distance between Banani and Gulshan-2 should be ~1.2-1.5 km",
                dist >= 1.0 && dist <= 1.6);

        double bearing = banani.bearingTo(gulshan2);
        assertTrue("Bearing towards east-northeast should be between 60 and 100 degrees",
                bearing >= 60.0 && bearing <= 100.0);
    }

    private static void testCoordinatesValidation() {
        boolean caught = false;
        try {
            new Coordinates(105.0, 90.0);
        } catch (IllegalArgumentException e) {
            caught = true;
        }
        assertTrue("Coordinates must reject invalid latitude > 90", caught);
    }

    private static void testGeofenceRayCasting() {
        DhakaGeofenceManager gm = new DhakaGeofenceManager();
        Coordinates insideGulshan2 = new Coordinates(23.7950, 90.4150);
        Coordinates outsideDhaka = new Coordinates(23.5000, 90.1000);

        var zone = gm.findZone(insideGulshan2);
        assertTrue("Ray-casting should identify Gulshan-2 zone",
                zone.isPresent() && zone.get().id().equals("gulshan_2"));

        var outside = gm.findZone(outsideDhaka);
        assertTrue("Ray-casting should return empty for external points",
                outside.isEmpty());
    }

    private static void testRickshawMunicipalRestrictions() {
        DhakaGeofenceManager gm = new DhakaGeofenceManager();
        Coordinates banani = new Coordinates(23.7915, 90.4030);
        Coordinates farPoint = new Coordinates(23.7100, 90.4030); // ~9 km away

        boolean permittedNear = gm.isTransitPermitted(TransitMode.RICKSHAW, banani, new Coordinates(23.7925, 90.4040));
        assertTrue("Short trip (<5km) in non-restricted zone should permit rickshaws", permittedNear);

        boolean permittedFar = gm.isTransitPermitted(TransitMode.RICKSHAW, banani, farPoint);
        assertTrue("Long trip (>5km) must restrict rickshaws", !permittedFar);
    }

    private static void testMohakhaliGeofenceAndFlyoverRestriction() {
        DhakaGeofenceManager gm = new DhakaGeofenceManager();
        Coordinates mohakhali = new Coordinates(23.7780, 90.3990);
        var zone = gm.findZone(mohakhali);
        assertTrue("Ray-casting should identify Mohakhali arterial corridor",
                zone.isPresent() && zone.get().id().equals("mohakhali_arterial"));
        assertTrue("Mohakhali arterial must restrict rickshaws on flyover corridor",
                zone.get().rickshawRestrictedCorridor());
        boolean rickshawPermitted = gm.isTransitPermitted(TransitMode.RICKSHAW, mohakhali, new Coordinates(23.7790, 90.4000));
        assertTrue("Rickshaw transit must be blocked within Mohakhali flyover arterial", !rickshawPermitted);
    }

    private static void testExpandedDhakaZones() {
        DhakaGeofenceManager gm = new DhakaGeofenceManager();
        Coordinates dhanmondi = new Coordinates(23.7465, 90.3760);
        Coordinates uttara = new Coordinates(23.8650, 90.4000);
        Coordinates mirpur = new Coordinates(23.8100, 90.3650);

        var dZone = gm.findZone(dhanmondi);
        assertTrue("Should identify Dhanmondi dining corridor",
                dZone.isPresent() && dZone.get().id().equals("dhanmondi"));

        var uZone = gm.findZone(uttara);
        assertTrue("Should identify Uttara sector hub",
                uZone.isPresent() && uZone.get().id().equals("uttara"));

        var mZone = gm.findZone(mirpur);
        assertTrue("Should identify Mirpur dining hub",
                mZone.isPresent() && mZone.get().id().equals("mirpur"));
    }

    private static void testPeakHourSurgeCurve() {
        TrafficDispatchEngine engine = new TrafficDispatchEngine();
        double eveningSurge = engine.calculateTimeOfDaySurge(LocalTime.of(19, 0));
        double nightSurge = engine.calculateTimeOfDaySurge(LocalTime.of(23, 30));

        assertTrue("Evening rush surge should be greater than late-night surge",
                eveningSurge > nightSurge && eveningSurge >= 1.80);
    }

    private static void testMonsoonSurgeImpact() {
        TrafficDispatchEngine engine = new TrafficDispatchEngine();
        Coordinates orig = new Coordinates(23.7915, 90.4030);
        Coordinates dest = new Coordinates(23.7937, 90.4150);
        LocalTime time = LocalTime.of(15, 0);

        TripQuote clearQuote = engine.quoteTrip(TransitMode.CNG, orig, dest, time, WeatherCondition.CLEAR);
        TripQuote rainQuote = engine.quoteTrip(TransitMode.CNG, orig, dest, time, WeatherCondition.HEAVY_MONSOON);

        assertTrue("Monsoon weather should increase travel time",
                rainQuote.estimatedDurationMinutes() > clearQuote.estimatedDurationMinutes());
        assertTrue("Monsoon weather should increase fare",
                rainQuote.fareBdt() >= clearQuote.fareBdt());
    }

    private static void testMultiModeDispatchQuote() {
        TrafficDispatchEngine engine = new TrafficDispatchEngine();
        Coordinates orig = new Coordinates(23.7915, 90.4030);
        Coordinates dest = new Coordinates(23.7937, 90.4150);

        List<TripQuote> quotes = engine.quoteAllModes(orig, dest, LocalTime.of(18, 0), WeatherCondition.CLEAR);
        assertTrue("Should return quotes for all 4 transit modes", quotes.size() == 4);

        TripQuote walking = quotes.stream().filter(q -> q.mode() == TransitMode.WALKING).findFirst().orElseThrow();
        assertTrue("Walking should have 0 fare", walking.fareBdt() == 0.0);
    }
}
