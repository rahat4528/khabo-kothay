#include "../include/RoutingCore.hpp"
#include <cmath>
#include <algorithm>

namespace KhaboKothay {

RoutingCore::RoutingCore() : congestionFactor(1.15) {
    // Calibrated transit rates for Dhaka Metropolitan Area baseline
    parameters[static_cast<int>(VehicleMode::Walking)] = {
        "Walking", 0.0, 0.0, 4.5, 0.0
    };
    parameters[static_cast<int>(VehicleMode::Rickshaw)] = {
        "Rickshaw", 25.0, 20.0, 11.0, 30.0
    };
    parameters[static_cast<int>(VehicleMode::CNG)] = {
        "CNG Auto-rickshaw", 60.0, 22.0, 18.0, 80.0
    };
    parameters[static_cast<int>(VehicleMode::Car)] = {
        "Car / Uber", 100.0, 28.0, 16.0, 130.0
    };
}

void RoutingCore::setModeParams(VehicleMode mode, const ModeParameters& params) {
    parameters[static_cast<int>(mode)] = params;
}

ModeParameters RoutingCore::getModeParams(VehicleMode mode) const {
    auto it = parameters.find(static_cast<int>(mode));
    if (it != parameters.end()) {
        return it->second;
    }
    return { "Unknown", 0.0, 0.0, 10.0, 0.0 };
}

void RoutingCore::setCongestionFactor(double factor) {
    congestionFactor = std::max(0.8, std::min(3.5, factor));
}

double RoutingCore::getCongestionFactor() const {
    return congestionFactor;
}

RouteEstimate RoutingCore::calculateRoute(double lat1, double lng1, double lat2, double lng2, VehicleMode mode) const {
    const double rawDistanceMeters = KDTree::haversineDistanceMeters(lat1, lng1, lat2, lng2);
    // Road network circuity factor in Dhaka urban dense grid ~1.28
    const double roadDistanceMeters = rawDistanceMeters * 1.28;
    const double distanceKm = roadDistanceMeters / 1000.0;

    const ModeParameters params = getModeParams(mode);

    // Speed adjusted by congestion (walking is immune to traffic congestion)
    const double effectiveSpeed = (mode == VehicleMode::Walking)
        ? params.avgSpeedKmh
        : std::max(3.0, params.avgSpeedKmh / congestionFactor);

    const double travelHours = distanceKm / effectiveSpeed;
    const double durationMinutes = travelHours * 60.0;

    // Fare calculation in BDT
    double fare = 0.0;
    if (mode != VehicleMode::Walking) {
        fare = params.baseFareBDT + (params.perKmRateBDT * distanceKm);
        fare = std::max(fare, params.minFareBDT);
        // Round to nearest integer BDT
        fare = std::round(fare);
    }

    std::string trafficCondition = "Low Traffic";
    if (congestionFactor >= 1.6) {
        trafficCondition = "Heavy Traffic";
    } else if (congestionFactor >= 1.25) {
        trafficCondition = "Moderate Traffic";
    }

    return {
        mode,
        params.name,
        roadDistanceMeters,
        durationMinutes,
        fare,
        trafficCondition
    };
}

std::vector<RouteEstimate> RoutingCore::compareAllModes(double lat1, double lng1, double lat2, double lng2) const {
    std::vector<RouteEstimate> estimates;
    estimates.reserve(4);

    estimates.push_back(calculateRoute(lat1, lng1, lat2, lng2, VehicleMode::Walking));
    estimates.push_back(calculateRoute(lat1, lng1, lat2, lng2, VehicleMode::Rickshaw));
    estimates.push_back(calculateRoute(lat1, lng1, lat2, lng2, VehicleMode::CNG));
    estimates.push_back(calculateRoute(lat1, lng1, lat2, lng2, VehicleMode::Car));

    return estimates;
}

std::vector<PlaceRecommendation> RoutingCore::rankCandidates(
    double userLat,
    double userLng,
    const std::vector<GeoPoint>& candidates,
    const std::string& preferredCuisine,
    double maxBudgetBDT,
    const std::string& priority
) const {
    std::vector<PlaceRecommendation> ranked;
    ranked.reserve(candidates.size());

    for (const auto& place : candidates) {
        // Skip over-budget candidates if price is specified
        if (place.pricePerPerson > 0 && place.pricePerPerson > maxBudgetBDT) {
            continue;
        }

        // Calculate Rickshaw route as primary Dhaka short-distance transport
        const RouteEstimate rRoute = calculateRoute(userLat, userLng, place.lat, place.lng, VehicleMode::Rickshaw);

        double cuisineBonus = 0.0;
        if (preferredCuisine != "All" && place.cuisine == preferredCuisine) {
            cuisineBonus = 15.0;
        }

        // Multi-attribute utility score (0 - 100)
        double score = 50.0;
        score += (place.rating / 5.0) * 30.0; // Up to 30 points for rating
        score += cuisineBonus;

        // Travel penalty: -1.2 points per minute of travel
        score -= (rRoute.durationMinutes * 1.2);

        // Budget efficiency
        if (place.pricePerPerson > 0) {
            const double budgetRatio = place.pricePerPerson / maxBudgetBDT;
            score += (1.0 - budgetRatio) * 12.0;
        }

        // Priority weighting adjustments
        if (priority == "Fastest") {
            score -= (rRoute.durationMinutes * 2.5);
        } else if (priority == "Cheapest") {
            score -= (rRoute.fareBDT * 0.4);
            if (place.pricePerPerson > 0) {
                score += (maxBudgetBDT - place.pricePerPerson) * 0.03;
            }
        } else if (priority == "Best Rated") {
            score += (place.rating / 5.0) * 25.0;
        }

        std::string reason;
        if (rRoute.durationMinutes <= 8.0) {
            reason = "Very close to your location — quick 5-8 min rickshaw trip";
        } else if (place.rating >= 4.5) {
            reason = "Highly rated dining option with verified community favorites";
        } else if (place.pricePerPerson > 0 && place.pricePerPerson <= 400.0) {
            reason = "Excellent budget-friendly menu with quick service";
        } else {
            reason = "Balanced pick for travel time, menu pricing, and quality";
        }

        ranked.push_back({
            place,
            score,
            rRoute.durationMinutes,
            rRoute.fareBDT,
            rRoute.modeName,
            reason
        });
    }

    std::sort(ranked.begin(), ranked.end(), [](const auto& a, const auto& b) {
        return a.rankScore > b.rankScore;
    });

    return ranked;
}

} // namespace KhaboKothay
