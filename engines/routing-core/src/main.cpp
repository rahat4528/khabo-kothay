#include <iostream>
#include <iomanip>
#include <chrono>
#include "../include/KDTree.hpp"
#include "../include/RoutingCore.hpp"

using namespace KhaboKothay;

int main() {
    std::cout << "=========================================================\n";
    std::cout << "  KHABO KOTHAY? (খাবো কোথায়?) - C++ High-Speed Routing Engine\n";
    std::cout << "=========================================================\n\n";

    // Sample dataset of Dhaka restaurants & cafes
    std::vector<GeoPoint> dataset = {
        GeoPoint("g1_1", "Gloria Jean's Coffees Gulshan 1", 23.7781, 90.4172, 650, 4.4, "Cafe"),
        GeoPoint("g1_2", "Sultan's Dine Gulshan 1", 23.7795, 90.4180, 520, 4.6, "Biriyani"),
        GeoPoint("g2_1", "North End Coffee Roasters Gulshan 2", 23.7925, 90.4165, 450, 4.7, "Cafe"),
        GeoPoint("g2_2", "Izumi Japanese Kitchen Gulshan 2", 23.7938, 90.4150, 2400, 4.8, "Japanese"),
        GeoPoint("g2_3", "Star Kabab & Restaurant Gulshan 2", 23.7915, 90.4190, 320, 4.3, "Kabab"),
        GeoPoint("b_1", "Takeout Burgers Banani 11", 23.7930, 90.4045, 480, 4.5, "Burger"),
        GeoPoint("b_2", "Madchef Banani Road 11", 23.7942, 90.4055, 550, 4.4, "Fast Food"),
        GeoPoint("b_3", "Chef's Table Banani", 23.7910, 90.4030, 850, 4.6, "All"),
        GeoPoint("bar_1", "The Pit Grill Baridhara", 23.8010, 90.4225, 1200, 4.6, "Steakhouse"),
        GeoPoint("bar_2", "Bunka Japanese Baridhara", 23.8025, 90.4230, 2100, 4.7, "Japanese"),
        GeoPoint("nb_1", "Haji Biriyani Notun Bazar", 23.7970, 90.4245, 300, 4.2, "Biriyani"),
        GeoPoint("nb_2", "Chaap Ghor Notun Bazar", 23.7985, 90.4255, 220, 4.1, "Fast Food")
    };

    // 1. Build KD-Tree
    std::cout << "[1] Initializing 2D KD-Tree Spatial Index...\n";
    KDTree kdTree;
    kdTree.build(dataset);
    std::cout << "    Indexed " << kdTree.size() << " locations in memory.\n\n";

    // 2. Query nearest restaurants from Dhaka user origin point
    const double userLat = 23.7975;
    const double userLng = 90.4250;
    std::cout << "[2] Finding 3 Nearest Restaurants to User (" << userLat << ", " << userLng << "):\n";
    auto nearest3 = kdTree.findKNearest(userLat, userLng, 3);
    for (size_t i = 0; i < nearest3.size(); ++i) {
        std::cout << "    " << (i + 1) << ". " << nearest3[i].first.name
                  << " (" << nearest3[i].first.cuisine << ") - "
                  << std::fixed << std::setprecision(1) << nearest3[i].second << "m away\n";
    }
    std::cout << "\n";

    // 3. Multi-Mode Route & Fare Matrix
    std::cout << "[3] Computing Multi-Mode Transport Matrix to Top Pick (" << nearest3[0].first.name << "):\n";
    RoutingCore routingCore;
    routingCore.setCongestionFactor(1.30); // Moderate Dhaka traffic

    auto modeQuotes = routingCore.compareAllModes(userLat, userLng, nearest3[0].first.lat, nearest3[0].first.lng);
    std::cout << "    Mode                | Est. Time | Est. Fare | Traffic Condition\n";
    std::cout << "    --------------------|-----------|-----------|------------------\n";
    for (const auto& quote : modeQuotes) {
        std::cout << "    " << std::left << std::setw(20) << quote.modeName
                  << "| " << std::setw(6) << std::fixed << std::setprecision(1) << quote.durationMinutes << " min "
                  << "| " << std::setw(6) << std::fixed << std::setprecision(0) << quote.fareBDT << " BDT "
                  << "| " << quote.trafficCondition << "\n";
    }
    std::cout << "\n";

    // 4. Recommendation Ranking
    std::cout << "[4] Evaluating Recommendations (Budget <= 1000 BDT, Best Overall):\n";
    auto recommendations = routingCore.rankCandidates(userLat, userLng, dataset, "All", 1000.0, "Best Overall");
    for (size_t i = 0; i < std::min<size_t>(recommendations.size(), 4); ++i) {
        const auto& rec = recommendations[i];
        std::cout << "    Rank " << (i + 1) << " [Score " << std::fixed << std::setprecision(1) << rec.rankScore << "]: "
                  << rec.place.name << " (" << rec.place.cuisine << ", ৳" << rec.place.pricePerPerson << "/person)\n"
                  << "           ↳ Trip: " << rec.travelDurationMinutes << " mins (" << rec.bestVehicleMode << " ৳" << rec.travelFareBDT << ")\n"
                  << "           ↳ Reason: " << rec.recommendationReason << "\n";
    }
    std::cout << "\n";

    // 5. High-Speed Microsecond Benchmark (100,000 spatial k-NN queries)
    std::cout << "[5] Running Microsecond Spatial Benchmark (100,000 k-NN Lookups)...\n";
    const int benchmarkIterations = 100000;
    auto start = std::chrono::high_resolution_clock::now();

    volatile double checksum = 0.0;
    (void)checksum;
    for (int i = 0; i < benchmarkIterations; ++i) {
        const double qLat = 23.7700 + (i % 300) * 0.0001;
        const double qLng = 90.4000 + (i % 300) * 0.0001;
        auto res = kdTree.findKNearest(qLat, qLng, 3);
        if (!res.empty()) checksum += res[0].second;
    }

    auto end = std::chrono::high_resolution_clock::now();
    auto elapsedMicros = std::chrono::duration_cast<std::chrono::microseconds>(end - start).count();
    const double avgLatencyMicros = static_cast<double>(elapsedMicros) / benchmarkIterations;

    std::cout << "    Completed " << benchmarkIterations << " queries in " << (elapsedMicros / 1000.0) << " ms\n";
    std::cout << "    Average Latency: " << std::fixed << std::setprecision(2) << avgLatencyMicros << " microseconds per lookup\n";
    std::cout << "    Throughput: " << static_cast<int>(1000000.0 / avgLatencyMicros) << " queries/sec\n\n";

    std::cout << "✅ C++ Routing & Spatial Index Engine executed successfully!\n";
    return 0;
}
