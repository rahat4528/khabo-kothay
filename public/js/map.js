import { esc } from './escape.js';
/**
 * Interactive Map Controller
 * Supports Leaflet (OpenStreetMap & CartoDB tiles) and Google Maps JavaScript API
 * Fallback interactive vector schematic if neither is available.
 * Zero raw hex colors: strictly adheres to brand design tokens.
 */

function getBrandColor(propName, fallback = 'currentColor') {
  if (typeof window !== 'undefined' && window.getComputedStyle) {
    const val = getComputedStyle(document.documentElement).getPropertyValue(propName).trim();
    if (val) return val;
  }
  return fallback;
}

class MapController {
  constructor() {
    this.container = null;
    this.mapInstance = null;
    this.tileLayer = null;
    this.userMarker = null;
    this.restaurantMarkers = [];
    this.routePolyline = null;
    this.isGoogleMapsLoaded = false;
    this.isLeaflet = false;
    this.activeId = null;
    this.darkMapStyles = null;
    this.onMarkerClick = null;
    this.cachedUserLocation = null;
  }

  async init(containerId, googleApiKey) {
    this.container = document.getElementById(containerId);
    if (!this.container) return;

    if (googleApiKey && typeof window.google === 'undefined') {
      try {
        await this.loadGoogleMapsScript(googleApiKey);
        this.isGoogleMapsLoaded = true;
      } catch (err) {
        console.warn('Google Maps JS API unavailable, attempting Leaflet.', err);
      }
    } else if (typeof window.google !== 'undefined' && window.google.maps) {
      this.isGoogleMapsLoaded = true;
    }

    if (this.isGoogleMapsLoaded && window.google?.maps) {
      await this.initGoogleMap();
    } else if (typeof window.L !== 'undefined') {
      this.initLeafletMap();
    } else {
      this.initMockMap();
    }
  }

  loadGoogleMapsScript(apiKey) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=geometry`;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = (e) => reject(e);
      document.head.appendChild(script);
    });
  }

  async loadDarkMapStyle() {
    if (this.darkMapStyles) return this.darkMapStyles;
    try {
      const res = await fetch('/brand/map-style-dark.json');
      if (res.ok) {
        this.darkMapStyles = await res.json();
        return this.darkMapStyles;
      }
    } catch (e) {
      console.warn('Could not load /brand/map-style-dark.json', e);
    }
    return [];
  }

  async initGoogleMap() {
    const center = { lat: 23.8103, lng: 90.4125 }; // Dhaka Centroid
    const isDark = this.isDarkModeActive();

    let styles = [];
    if (isDark) {
      styles = await this.loadDarkMapStyle();
    }

    this.mapInstance = new google.maps.Map(this.container, {
      center,
      zoom: 14,
      styles,
      disableDefaultUI: false,
      zoomControl: true
    });
  }

  initLeafletMap() {
    try {
      this.isLeaflet = true;
      // In case container already had a Leaflet instance
      if (this.mapInstance && this.mapInstance.remove) {
        this.mapInstance.remove();
      }

      const defaultCenter = [23.8103, 90.4125]; // Dhaka Centroid
      this.mapInstance = L.map(this.container, {
        center: defaultCenter,
        zoom: 14,
        zoomControl: true,
        scrollWheelZoom: true
      });

      this.updateLeafletTiles();
    } catch (err) {
      console.warn('Leaflet initialization failed, falling back to mock map.', err);
      this.isLeaflet = false;
      this.initMockMap();
    }
  }

  isDarkModeActive() {
    return document.documentElement.getAttribute('data-theme') === 'dark' ||
      (!document.documentElement.getAttribute('data-theme') && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  }

  updateLeafletTiles() {
    if (!this.isLeaflet || !this.mapInstance) return;

    if (this.tileLayer) {
      this.mapInstance.removeLayer(this.tileLayer);
    }

    const isDark = this.isDarkModeActive();
    const tileUrl = isDark
      ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
      : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';

    const attribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

    this.tileLayer = L.tileLayer(tileUrl, {
      subdomains: 'abcd',
      maxZoom: 19,
      attribution
    }).addTo(this.mapInstance);
  }

  async applyTheme() {
    const isDark = this.isDarkModeActive();
    if (this.isGoogleMapsLoaded && this.mapInstance && typeof google !== 'undefined' && google.maps) {
      const styles = isDark ? await this.loadDarkMapStyle() : [];
      this.mapInstance.setOptions({ styles });
    } else if (this.isLeaflet && this.mapInstance) {
      this.updateLeafletTiles();
    }
  }

  initMockMap() {
    if (!this.container) return;
    this.container.innerHTML = `
      <div class="mock-map-view" id="mockMapCanvas">
        <div class="map-overlay-badge">
          <span>📍 Dhaka Food Map (Interactive View)</span>
        </div>
        <svg id="mockMapSvg" class="map-svg-layer" viewBox="0 0 800 600"></svg>
        <div id="mockMapMarkers" class="map-markers-layer"></div>
      </div>
    `;
  }

  update(userLocation, restaurants, onMarkerClick) {
    this.cachedUserLocation = userLocation;
    this.onMarkerClick = onMarkerClick;

    if (this.isGoogleMapsLoaded && this.mapInstance) {
      this.updateGoogleMap(userLocation, restaurants);
    } else if (this.isLeaflet && this.mapInstance) {
      this.updateLeafletMap(userLocation, restaurants);
    } else {
      this.updateMockMap(userLocation, restaurants);
    }
  }

  updateLeafletMap(userLocation, restaurants) {
    // Clear user marker
    if (this.userMarker) {
      this.mapInstance.removeLayer(this.userMarker);
      this.userMarker = null;
    }
    // Clear restaurant markers
    for (const m of this.restaurantMarkers) {
      if (m.marker) this.mapInstance.removeLayer(m.marker);
    }
    this.restaurantMarkers = [];
    // Clear polyline
    if (this.routePolyline) {
      this.mapInstance.removeLayer(this.routePolyline);
      this.routePolyline = null;
    }

    const bounds = L.latLngBounds();

    // 1. User Location Marker
    if (userLocation && Number.isFinite(userLocation.lat) && Number.isFinite(userLocation.lng)) {
      const uLatLng = [userLocation.lat, userLocation.lng];
      bounds.extend(uLatLng);

      const userIcon = L.divIcon({
        className: 'leaflet-user-marker-wrap',
        html: `
          <div class="leaflet-user-marker" title="Your Location: ${esc(userLocation.name || 'Current')}">
            <div class="pulse-ring"></div>
            <div class="user-dot"></div>
          </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      });

      this.userMarker = L.marker(uLatLng, { icon: userIcon, zIndexOffset: 500 }).addTo(this.mapInstance);
      this.userMarker.bindTooltip(`📍 You are here (${esc(userLocation.name || 'Starting Point')})`, {
        direction: 'top',
        offset: [0, -10]
      });
    }

    // 2. Restaurant Markers
    restaurants.forEach((r, idx) => {
      if (!r.location || !Number.isFinite(r.location.latitude) || !Number.isFinite(r.location.longitude)) return;
      const rLatLng = [r.location.latitude, r.location.longitude];
      bounds.extend(rLatLng);

      const placeIcon = L.divIcon({
        className: 'leaflet-place-marker-wrap',
        html: `
          <div class="leaflet-place-marker ${r.id === this.activeId ? 'active' : ''}" id="leaflet-pin-${r.id}">
            <span class="pin-number">${idx + 1}</span>
          </div>
        `,
        iconSize: [30, 30],
        iconAnchor: [15, 15]
      });

      const marker = L.marker(rLatLng, { icon: placeIcon }).addTo(this.mapInstance);

      // Popup Content
      const directionsUrl = this.getGoogleMapsDirectionsUrl(userLocation, r);
      const costAmount = r.estimatedCostPerPersonBdt || r.menu?.estimatedCostPerPerson?.amount;
      const costStr = costAmount ? `৳${costAmount}/person` : '৳'.repeat(r.priceLevel || 2);
      const distKm = r.distanceMeters ? (r.distanceMeters / 1000).toFixed(1) : '?';
      // Don't invent a travel time when routing failed (straight-line fallback has none)
      const travelStr = r.durationSeconds
        ? `🚗 ${Math.max(1, Math.round(r.durationSeconds / 60))} min (${distKm} km)`
        : `${distKm} km (straight-line)`;

      const popupHtml = `
        <div class="map-popup-card">
          <h4 class="map-popup-title">${idx + 1}. ${esc(r.displayName)}</h4>
          <div class="map-popup-meta">${esc(r.cuisine)} • ⭐ ${r.rating || 4.2} (${r.userRatingCount || 100}+ reviews)</div>
          <div class="map-popup-cost">${esc(costStr)} • ${esc(travelStr)}</div>
          <div class="map-popup-actions">
            <a href="${esc(directionsUrl)}" target="_blank" rel="noopener noreferrer" class="map-popup-btn primary">
              🧭 Directions
            </a>
          </div>
        </div>
      `;

      marker.bindPopup(popupHtml, { maxWidth: 260, offset: [0, -10] });

      marker.on('click', () => {
        if (this.onMarkerClick) this.onMarkerClick(r);
        this.highlightRestaurant(userLocation, r);
      });

      this.restaurantMarkers.push({ id: r.id, marker, restaurant: r });
    });

    // 3. Fit bounds
    if (bounds.isValid()) {
      this.mapInstance.fitBounds(bounds, { padding: [36, 36], maxZoom: 16 });
    }
  }

  updateGoogleMap(userLocation, restaurants) {
    if (this.userMarker) this.userMarker.setMap(null);
    for (const m of this.restaurantMarkers) m.marker.setMap(null);
    this.restaurantMarkers = [];
    if (this.routePolyline) this.routePolyline.setMap(null);

    const bounds = new google.maps.LatLngBounds();
    const primaryColor = getBrandColor('--color-primary', 'indigo');
    const onPrimaryColor = getBrandColor('--color-on-primary', 'white');
    const surfaceColor = getBrandColor('--color-surface', 'white');

    // User Marker
    const userLatLng = { lat: userLocation.lat, lng: userLocation.lng };
    bounds.extend(userLatLng);
    this.userMarker = new google.maps.Marker({
      position: userLatLng,
      map: this.mapInstance,
      title: 'Your Location: ' + (userLocation.name || 'Current'),
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 9,
        fillColor: primaryColor,
        fillOpacity: 1,
        strokeColor: surfaceColor,
        strokeWeight: 3
      }
    });

    // Restaurant Markers
    restaurants.forEach((r, idx) => {
      const pos = { lat: r.location.latitude, lng: r.location.longitude };
      bounds.extend(pos);

      const marker = new google.maps.Marker({
        position: pos,
        map: this.mapInstance,
        label: {
          text: String(idx + 1),
          color: onPrimaryColor,
          fontWeight: 'bold'
        },
        title: `${idx + 1}. ${r.displayName}`
      });

      marker.addListener('click', () => {
        if (this.onMarkerClick) this.onMarkerClick(r);
        this.highlightRestaurant(userLocation, r);
      });

      this.restaurantMarkers.push({ id: r.id, marker, restaurant: r });
    });

    if (restaurants.length > 0) {
      this.mapInstance.fitBounds(bounds, { top: 40, right: 40, bottom: 40, left: 40 });
    }
  }

  updateMockMap(userLocation, restaurants) {
    const markersContainer = document.getElementById('mockMapMarkers');
    const svgLayer = document.getElementById('mockMapSvg');
    if (!markersContainer || !svgLayer) return;

    markersContainer.innerHTML = '';
    svgLayer.innerHTML = `
      <defs>
        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="var(--color-line)" stroke-width="1"/>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="var(--color-bg)"/>
      <rect width="100%" height="100%" fill="url(#grid)" />
      <!-- Gulshan Lake Graphic -->
      <path d="M 450 0 C 430 180, 480 320, 440 600" fill="none" stroke="var(--color-surface-alt)" stroke-width="40" opacity="0.6"/>
      <path d="M 450 0 C 430 180, 480 320, 440 600" fill="none" stroke="var(--color-primary-tint)" stroke-width="4" opacity="0.8"/>
      <!-- Main Roads -->
      <line x1="50" y1="280" x2="750" y2="280" stroke="var(--color-line)" stroke-width="12" stroke-linecap="round"/>
      <line x1="380" y1="50" x2="380" y2="550" stroke="var(--color-line)" stroke-width="10" stroke-linecap="round"/>
      <g id="mockRouteLines"></g>
    `;

    const minLat = 23.770, maxLat = 23.810;
    const minLng = 90.395, maxLng = 90.435;

    const toX = (lng) => Math.max(40, Math.min(760, ((lng - minLng) / (maxLng - minLng)) * 720 + 40));
    const toY = (lat) => Math.max(40, Math.min(560, (1 - (lat - minLat) / (maxLat - minLat)) * 520 + 40));

    // User pin
    const uX = toX(userLocation.lat ? userLocation.lng : 90.415);
    const uY = toY(userLocation.lat ? userLocation.lat : 23.792);

    const userPin = document.createElement('div');
    userPin.className = 'map-user-pin user-marker';
    userPin.style.left = `${(uX / 800) * 100}%`;
    userPin.style.top = `${(uY / 600) * 100}%`;
    userPin.innerHTML = `<div class="pulse-ring"></div><div class="user-dot" title="You are here"></div>`;
    markersContainer.appendChild(userPin);

    // Restaurant pins
    restaurants.forEach((r, idx) => {
      const rX = toX(r.location.longitude);
      const rY = toY(r.location.latitude);

      const rPin = document.createElement('div');
      rPin.className = `map-place-pin ${r.id === this.activeId ? 'active' : ''}`;
      rPin.id = `map-pin-${r.id}`;
      rPin.style.left = `${(rX / 800) * 100}%`;
      rPin.style.top = `${(rY / 600) * 100}%`;
      rPin.innerHTML = `<span class="pin-number">${idx + 1}</span>`;
      rPin.title = `${r.displayName} (${r.cuisine})`;

      rPin.onclick = () => {
        if (this.onMarkerClick) this.onMarkerClick(r);
        this.highlightRestaurant(userLocation, r);
      };

      markersContainer.appendChild(rPin);
    });

    if (restaurants.length > 0) {
      this.highlightRestaurant(userLocation, restaurants[0]);
    }
  }

  highlightRestaurant(userLocation, restaurant) {
    if (!restaurant) return;
    this.activeId = restaurant.id;
    const primaryColor = getBrandColor('--color-primary', 'orange');

    if (this.isLeaflet && this.mapInstance) {
      const pos = [restaurant.location.latitude, restaurant.location.longitude];

      // Update active pin visual
      document.querySelectorAll('.leaflet-place-marker').forEach(el => el.classList.remove('active'));
      const activePin = document.getElementById(`leaflet-pin-${restaurant.id}`);
      if (activePin) activePin.classList.add('active');

      // Draw route polyline from user position to restaurant
      if (this.routePolyline) {
        this.mapInstance.removeLayer(this.routePolyline);
      }
      if (userLocation && Number.isFinite(userLocation.lat) && Number.isFinite(userLocation.lng)) {
        this.routePolyline = L.polyline(
          [[userLocation.lat, userLocation.lng], pos],
          {
            color: primaryColor,
            weight: 5,
            opacity: 0.9,
            dashArray: '8, 6',
            lineCap: 'round'
          }
        ).addTo(this.mapInstance);
      }

      // Open marker popup
      const targetM = this.restaurantMarkers.find(m => m.id === restaurant.id);
      if (targetM && targetM.marker) {
        targetM.marker.openPopup();
      }

      this.mapInstance.panTo(pos, { animate: true });
    } else if (this.isGoogleMapsLoaded && this.mapInstance) {
      const pos = { lat: restaurant.location.latitude, lng: restaurant.location.longitude };
      this.mapInstance.panTo(pos);

      if (this.routePolyline) this.routePolyline.setMap(null);
      this.routePolyline = new google.maps.Polyline({
        path: [
          { lat: userLocation.lat, lng: userLocation.lng },
          pos
        ],
        geodesic: true,
        strokeColor: primaryColor,
        strokeOpacity: 0.95,
        strokeWeight: 6,
        map: this.mapInstance
      });
    } else {
      document.querySelectorAll('.map-place-pin').forEach(p => p.classList.remove('active'));
      const activePin = document.getElementById(`map-pin-${restaurant.id}`);
      if (activePin) activePin.classList.add('active');

      const routeGroup = document.getElementById('mockRouteLines');
      if (routeGroup && userLocation) {
        const minLat = 23.770, maxLat = 23.810;
        const minLng = 90.395, maxLng = 90.435;
        const toX = (lng) => Math.max(40, Math.min(760, ((lng - minLng) / (maxLng - minLng)) * 720 + 40));
        const toY = (lat) => Math.max(40, Math.min(560, (1 - (lat - minLat) / (maxLat - minLat)) * 520 + 40));

        const uX = toX(userLocation.lng);
        const uY = toY(userLocation.lat);
        const rX = toX(restaurant.location.longitude);
        const rY = toY(restaurant.location.latitude);

        routeGroup.innerHTML = `
          <line x1="${uX}" y1="${uY}" x2="${rX}" y2="${rY}" stroke="var(--color-primary)" stroke-width="5" stroke-dasharray="6 4"/>
        `;
      }
    }
  }

  highlightMarker(placeId) {
    const target = this.restaurantMarkers.find(m => m.id === placeId);
    if (target && this.cachedUserLocation) {
      this.highlightRestaurant(this.cachedUserLocation, target.restaurant);
    }
  }

  getGoogleMapsDirectionsUrl(userLocation, restaurant) {
    if (!restaurant?.location) return '#';
    const origin = (userLocation && userLocation.lat && userLocation.lng)
      ? `${userLocation.lat},${userLocation.lng}`
      : '23.7925,90.4150';
    const destination = `${restaurant.location.latitude},${restaurant.location.longitude}`;
    return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}`;
  }
}

export const mapController = new MapController();
export default mapController;
