package com.khabokothay;

import com.khabokothay.geofence.DhakaGeofenceManager;
import com.khabokothay.model.Coordinates;
import com.khabokothay.model.RestaurantPlace;
import com.khabokothay.model.TripQuote;
import com.khabokothay.traffic.TrafficDispatchEngine;
import com.khabokothay.traffic.TrafficDispatchEngine.WeatherCondition;

import java.time.LocalTime;
import java.util.List;

/**
 * Khabo Kothay - Java Enterprise Traffic Dispatch & Geofencing Service CLI Runner
 */
public class TrafficApp {

    public static void main(String[] args) {
        System.out.println("======================================================================");
        System.out.println(" KHABO KOTHAY - JAVA ENTERPRISE TRAFFIC DISPATCH & GEOFENCING ENGINE");
        System.out.println("======================================================================");

        DhakaGeofenceManager geofenceManager = new DhakaGeofenceManager();
        TrafficDispatchEngine engine = new TrafficDispatchEngine(geofenceManager);

        // 1. Zone Geofence Spatial Lookups
        System.out.println("\n[1/3] Spatial Zone Resolution (Jordan Curve Ray-Casting)...");
        Coordinates ptGulshan2 = new Coordinates(23.7937, 90.4150); // Gulshan-2 Diplomatic Corridor
        Coordinates ptBanani = new Coordinates(23.7915, 90.4030);   // Banani 11 Dining Strip
        Coordinates ptMohakhali = new Coordinates(23.7780, 90.3990); // Mohakhali Arterial
        Coordinates ptDhanmondi = new Coordinates(23.7465, 90.3760); // Dhanmondi Satmasjid Road
        Coordinates ptKeraniganj = new Coordinates(23.6800, 90.3800); // Out-of-zone baseline

        System.out.printf("  Point %s -> %s\n", ptGulshan2, geofenceManager.resolveAreaName(ptGulshan2));
        System.out.printf("  Point %s -> %s\n", ptBanani, geofenceManager.resolveAreaName(ptBanani));
        System.out.printf("  Point %s -> %s\n", ptMohakhali, geofenceManager.resolveAreaName(ptMohakhali));
        System.out.printf("  Point %s -> %s\n", ptDhanmondi, geofenceManager.resolveAreaName(ptDhanmondi));
        System.out.printf("  Point %s -> %s\n", ptKeraniganj, geofenceManager.resolveAreaName(ptKeraniganj));

        // 2. Real-Time Dynamic Trip Quotations
        System.out.println("\n[2/3] Multi-Modal Dispatch Quotations (Banani 11 -> Gulshan-2)...");
        LocalTime eveningRush = LocalTime.of(19, 30);
        System.out.printf("  Departure Time: %s (Dhaka Evening Rush) | Weather: CLEAR\n", eveningRush);
        
        List<TripQuote> quotesRush = engine.quoteAllModes(ptBanani, ptGulshan2, eveningRush, WeatherCondition.CLEAR);
        for (TripQuote q : quotesRush) {
            System.out.println("    " + q.formattedSummary());
        }

        System.out.println("\n  Scenario B: Same Route during HEAVY MONSOON RAIN...");
        List<TripQuote> quotesMonsoon = engine.quoteAllModes(ptBanani, ptGulshan2, eveningRush, WeatherCondition.HEAVY_MONSOON);
        for (TripQuote q : quotesMonsoon) {
            System.out.println("    " + q.formattedSummary());
        }

        // 3. High-Throughput Spatial Dispatch Micro-Benchmark
        System.out.println("\n[3/3] High-Throughput Java Dispatch Micro-Benchmark...");
        int iterations = 100_000;
        long startNano = System.nanoTime();
        int validQuotes = 0;

        for (int i = 0; i < iterations; i++) {
            double offset = (i % 50) * 0.0001;
            Coordinates orig = new Coordinates(23.7900 + offset, 90.4000 + offset);
            Coordinates dest = new Coordinates(23.7950 - offset, 90.4150 - offset);
            List<TripQuote> qList = engine.quoteAllModes(orig, dest, eveningRush, WeatherCondition.CLEAR);
            validQuotes += qList.size();
        }

        long elapsedNano = System.nanoTime() - startNano;
        double elapsedMs = elapsedNano / 1_000_000.0;
        double qps = (iterations * 4.0) / (elapsedMs / 1000.0);
        double latencyMicros = (elapsedNano / (iterations * 4.0)) / 1000.0;

        System.out.printf("  Benchmarked %d route dispatch calculations (%d quotes generated).\n", iterations, validQuotes);
        System.out.printf("  Total Time: %.2f ms | Throughput: %,.0f quotes/sec | Latency: %.2f microseconds/quote\n",
                elapsedMs, qps, latencyMicros);

        System.out.println("\n======================================================================");
        System.out.println(" [OK] Java Enterprise Traffic Dispatch Execution Succeeded!");
        System.out.println("======================================================================");
    }
}
