package com.khabokothay.geofence;

import com.khabokothay.model.Coordinates;
import com.khabokothay.model.TransitMode;

import java.util.*;

/**
 * Enterprise Geofencing & Spatial Zone Policy Engine for Dhaka Metropolitan Area.
 * Uses Jordan Curve theorem (Ray-Casting Algorithm) for point-in-polygon resolution
 * and applies municipal transit corridor regulations.
 */
public class DhakaGeofenceManager {

    public record GeofenceZone(
            String id,
            String displayName,
            List<Coordinates> polygonBoundary,
            double baselineCongestionIndex,
            boolean rickshawRestrictedCorridor
    ) {
        /**
         * Standard Ray-Casting algorithm to check if a point lies inside this polygon.
         */
        public boolean containsPoint(Coordinates point) {
            int n = polygonBoundary.size();
            if (n < 3) return false;

            boolean inside = false;
            double x = point.longitude();
            double y = point.latitude();

            for (int i = 0, j = n - 1; i < n; j = i++) {
                double xi = polygonBoundary.get(i).longitude();
                double yi = polygonBoundary.get(i).latitude();
                double xj = polygonBoundary.get(j).longitude();
                double yj = polygonBoundary.get(j).latitude();

                boolean intersect = ((yi > y) != (yj > y)) &&
                        (x < (xj - xi) * (y - yi) / (yj - yi) + xi);

                if (intersect) {
                    inside = !inside;
                }
            }
            return inside;
        }
    }

    private final Map<String, GeofenceZone> zones = new LinkedHashMap<>();

    public DhakaGeofenceManager() {
        initDhakaZones();
    }

    private void initDhakaZones() {
        // Gulshan-2 Dining & Diplomatic Zone
        zones.put("gulshan_2", new GeofenceZone(
                "gulshan_2",
                "Gulshan-2 Diplomatic Corridor",
                List.of(
                        new Coordinates(23.7900, 90.4080),
                        new Coordinates(23.8050, 90.4100),
                        new Coordinates(23.8060, 90.4220),
                        new Coordinates(23.7910, 90.4240)
                ),
                1.45,
                false
        ));

        // Gulshan-1 Commercial & Circle Hub
        zones.put("gulshan_1", new GeofenceZone(
                "gulshan_1",
                "Gulshan-1 Circle & Lake Zone",
                List.of(
                        new Coordinates(23.7740, 90.4100),
                        new Coordinates(23.7899, 90.4100),
                        new Coordinates(23.7899, 90.4250),
                        new Coordinates(23.7740, 90.4230)
                ),
                1.75,
                false
        ));

        // Banani Food Strip (Road 11 & Kemal Ataturk)
        zones.put("banani", new GeofenceZone(
                "banani",
                "Banani Road 11 Dining Strip",
                List.of(
                        new Coordinates(23.7850, 90.3980),
                        new Coordinates(23.8020, 90.3980),
                        new Coordinates(23.8020, 90.4079),
                        new Coordinates(23.7850, 90.4079)
                ),
                1.55,
                false
        ));

        // Mohakhali Arterial / Flyover Corridor (Rickshaw Restricted)
        zones.put("mohakhali_arterial", new GeofenceZone(
                "mohakhali_arterial",
                "Mohakhali Flyover Arterial Corridor",
                List.of(
                        new Coordinates(23.7680, 90.3950),
                        new Coordinates(23.7840, 90.3950),
                        new Coordinates(23.7840, 90.4050),
                        new Coordinates(23.7680, 90.4050)
                ),
                2.10,
                true // Non-motorized rickshaws restricted by municipal law
        ));

        // Dhanmondi Culinary & Cultural Corridor (Satmasjid Road)
        zones.put("dhanmondi", new GeofenceZone(
                "dhanmondi",
                "Dhanmondi Satmasjid Road Corridor",
                List.of(
                        new Coordinates(23.7350, 90.3650),
                        new Coordinates(23.7600, 90.3650),
                        new Coordinates(23.7600, 90.3850),
                        new Coordinates(23.7350, 90.3850)
                ),
                1.60,
                false
        ));

        // Uttara Sector Hub (Rabindra Sarani & Jasimuddin Avenue)
        zones.put("uttara", new GeofenceZone(
                "uttara",
                "Uttara Sector Hub",
                List.of(
                        new Coordinates(23.8500, 90.3850),
                        new Coordinates(23.8850, 90.3850),
                        new Coordinates(23.8850, 90.4150),
                        new Coordinates(23.8500, 90.4150)
                ),
                1.40,
                false
        ));

        // Mirpur Culinary Hub (Mirpur 1, 2, 10, 11)
        zones.put("mirpur", new GeofenceZone(
                "mirpur",
                "Mirpur Central Dining Hub",
                List.of(
                        new Coordinates(23.7950, 90.3500),
                        new Coordinates(23.8300, 90.3500),
                        new Coordinates(23.8300, 90.3800),
                        new Coordinates(23.7950, 90.3800)
                ),
                1.50,
                false
        ));
    }

    /**
     * Resolves the matching geofence zone for given coordinates, or empty if outside modeled zones.
     */
    public Optional<GeofenceZone> findZone(Coordinates coordinates) {
        for (GeofenceZone zone : zones.values()) {
            if (zone.containsPoint(coordinates)) {
                return Optional.of(zone);
            }
        }
        return Optional.empty();
    }

    /**
     * Returns the human-readable area name.
     */
    public String resolveAreaName(Coordinates coordinates) {
        return findZone(coordinates)
                .map(GeofenceZone::displayName)
                .orElse("Greater Dhaka Metropolitan Area");
    }

    /**
     * Checks if a transit mode is legally permitted between origin and destination coordinates.
     */
    public boolean isTransitPermitted(TransitMode mode, Coordinates origin, Coordinates destination) {
        if (mode != TransitMode.RICKSHAW) {
            return true; // Motorized & walking are permitted across zones
        }

        // Rickshaws cannot traverse into or through restricted arterial corridors
        Optional<GeofenceZone> origZone = findZone(origin);
        Optional<GeofenceZone> destZone = findZone(destination);

        if (origZone.isPresent() && origZone.get().rickshawRestrictedCorridor()) {
            return false;
        }
        if (destZone.isPresent() && destZone.get().rickshawRestrictedCorridor()) {
            return false;
        }

        // Cross-zone rickshaw trips exceeding 5 km are banned due to municipal rickshaw zone limits
        return origin.distanceToKm(destination) <= 5.0;
    }

    /**
     * Computes the combined spatial congestion factor across origin and destination zones.
     */
    public double getAggregateZoneCongestion(Coordinates origin, Coordinates destination) {
        double origFactor = findZone(origin).map(GeofenceZone::baselineCongestionIndex).orElse(1.20);
        double destFactor = findZone(destination).map(GeofenceZone::baselineCongestionIndex).orElse(1.20);
        return (origFactor + destFactor) / 2.0;
    }

    public Map<String, GeofenceZone> getAllZones() {
        return Collections.unmodifiableMap(zones);
    }
}
