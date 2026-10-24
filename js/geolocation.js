/**
 * HCM Lite — Geolocation & Office Geofence Verification (Bonus Feature B)
 * - Uses native navigator.geolocation.getCurrentPosition()
 * - Haversine distance formula calculation in meters
 * - Real-time proximity checking against Admin-configured office coordinates
 * - Proper error handling (permission denied, timeout, unavailable)
 */

const GeoLocationService = (() => {
  // Haversine formula to compute distance in meters between two lat/lng coordinates
  function calculateDistanceInMeters(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth radius in meters
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

    const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
              Math.cos(phi1) * Math.cos(phi2) *
              Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return Math.round(R * c);
  }

  // Check if browser supports Geolocation
  function isGeoSupported() {
    return 'geolocation' in navigator;
  }

  // Get current device position
  function getCurrentPosition(options = {}) {
    return new Promise((resolve, reject) => {
      if (!isGeoSupported()) {
        reject(new Error('Geolocation is not supported by this browser.'));
        return;
      }

      const defaultOptions = {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
        ...options
      };

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: Math.round(position.coords.accuracy),
            timestamp: position.timestamp
          });
        },
        (error) => {
          let message = 'Unable to retrieve location.';
          switch (error.code) {
            case error.PERMISSION_DENIED:
              message = 'Location access was denied. Please allow location access in your browser settings to verify office check-in.';
              break;
            case error.POSITION_UNAVAILABLE:
              message = 'Location information is unavailable on your device.';
              break;
            case error.TIMEOUT:
              message = 'The location request timed out. Please try again.';
              break;
          }
          reject(new Error(message));
        },
        defaultOptions
      );
    });
  }

  // Verify whether current position is within office geofence
  async function verifyOfficeProximity() {
    const company = Storage.getCompany();
    if (!company) {
      throw new Error('Company settings not found.');
    }

    if (company.officeLat == null || company.officeLng == null) {
      throw new Error('Office coordinates have not been configured by the Admin yet.');
    }

    const officeRadius = parseInt(company.officeRadius, 10) || 150;
    const currentPos = await getCurrentPosition();

    const distance = calculateDistanceInMeters(
      currentPos.latitude,
      currentPos.longitude,
      parseFloat(company.officeLat),
      parseFloat(company.officeLng)
    );

    const isInside = distance <= officeRadius;

    return {
      isInside,
      distance,
      officeRadius,
      accuracy: currentPos.accuracy,
      currentLatitude: currentPos.latitude,
      currentLongitude: currentPos.longitude,
      officeLatitude: parseFloat(company.officeLat),
      officeLongitude: parseFloat(company.officeLng)
    };
  }

  return {
    isGeoSupported,
    getCurrentPosition,
    calculateDistanceInMeters,
    verifyOfficeProximity
  };
})();
