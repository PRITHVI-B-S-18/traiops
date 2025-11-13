import { useState, useEffect, useCallback } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Custom hook for managing location permissions and getting current location with reverse geocoding
 */
export const useLocation = (userId) => {
  const [locationPermission, setLocationPermission] = useState(null); // 'granted', 'denied', 'prompt', null
  const [currentLocation, setCurrentLocation] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  // Check permission status on mount
  useEffect(() => {
    const checkPermission = async () => {
      if (!navigator.permissions) {
        setLocationPermission('prompt');
        return;
      }

      try {
        const permission = await navigator.permissions.query({ name: 'geolocation' });
        setLocationPermission(permission.state);

        // Listen for permission changes
        permission.addEventListener('change', () => {
          setLocationPermission(permission.state);
        });
      } catch (err) {
        console.error('Error checking location permission:', err);
        setLocationPermission('prompt');
      }
    };

    checkPermission();
  }, []);

  /**
   * Reverse geocode coordinates to get detailed address
   * Using Mapbox Geocoding API (precise location detection)
   */
  const reverseGeocode = useCallback(async (lat, lng) => {
    console.log('🌐 Starting reverse geocoding with Mapbox...');
    console.log('📍 Coordinates:', { lat, lng });

    try {
      // Get API token from environment
      const accessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;
      
      if (!accessToken || accessToken === 'your_mapbox_token_here') {
        console.warn('⚠️ Mapbox access token not configured, falling back to BigDataCloud');
        return await reverseGeocodeWithBigDataCloud(lat, lng);
      }

      // Using Mapbox Geocoding API - Better accuracy for institutions
      // Note: Mapbox uses longitude,latitude order (not latitude,longitude)
      const geocodeUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${accessToken}&types=poi,address,neighborhood,locality,place,region,country,postcode`;
      console.log('🌐 Mapbox URL:', geocodeUrl.replace(accessToken, 'TOKEN_HIDDEN'));

      const response = await fetch(geocodeUrl);

      console.log('🌐 Geocoding response status:', response.status, response.statusText);

      if (!response.ok) {
        throw new Error(`Mapbox API failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('🌐 Raw Mapbox data:', data);

      if (!data.features || data.features.length === 0) {
        throw new Error('No geocoding results found');
      }

      // Mapbox returns features ordered by relevance
      // Reference: https://docs.mapbox.com/api/search/geocoding-v5/#geographical-feature-types
      const features = data.features;
      const mainFeature = features[0] || {};
      const context = mainFeature.context || [];
      
      // According to Mapbox docs, context array contains hierarchical data in this order:
      // country → region → district → place (city) → locality → neighborhood → postcode
      // Reference: https://docs.mapbox.com/api/search/geocoding-v5/#example-request-reverse-geocoding
      
      // Extract from context array (most reliable for hierarchical data)
      // Context items have IDs like: "country.xxx", "region.xxx", "place.xxx", etc.
      const countryFromContext = context.find(c => c.id?.startsWith('country.')) || {};
      const regionFromContext = context.find(c => c.id?.startsWith('region.')) || {};
      const districtFromContext = context.find(c => c.id?.startsWith('district.')) || {};
      const placeFromContext = context.find(c => c.id?.startsWith('place.')) || {}; // This is the CITY
      const localityFromContext = context.find(c => c.id?.startsWith('locality.')) || {};
      const neighborhoodFromContext = context.find(c => c.id?.startsWith('neighborhood.')) || {};
      const postcodeFromContext = context.find(c => c.id?.startsWith('postcode.')) || {};
      
      // Also extract from direct features (as fallback)
      const poi = features.find(f => f.place_type.includes('poi')) || {};
      const address = features.find(f => f.place_type.includes('address')) || {};
      const neighborhood = features.find(f => f.place_type.includes('neighborhood')) || {};
      const placeFeature = features.find(f => f.place_type.includes('place')) || {};
      const locality = features.find(f => f.place_type.includes('locality')) || {};
      const region = features.find(f => f.place_type.includes('region')) || {};
      const country = features.find(f => f.place_type.includes('country')) || {};
      const postcode = features.find(f => f.place_type.includes('postcode')) || {};
      
      console.log('🌐 Mapbox Response Analysis:');
      console.log('  - Total features:', features.length);
      console.log('  - Context items:', context.length);
      console.log('  - Context breakdown:', {
        country: countryFromContext.text || 'N/A',
        region: regionFromContext.text || 'N/A',
        district: districtFromContext.text || 'N/A',
        place: placeFromContext.text || 'N/A', // CITY
        locality: localityFromContext.text || 'N/A',
        neighborhood: neighborhoodFromContext.text || 'N/A',
        postcode: postcodeFromContext.text || 'N/A'
      });
      
      // Extract detailed address information
      // Priority: Context array (most reliable) > Direct features
      
      // Building/Institution: POI or address name
      const building = poi.text || address.properties?.name || '';
      const institution = poi.properties?.category?.includes('school') || 
                         poi.properties?.category?.includes('college') || 
                         poi.properties?.category?.includes('university') ? poi.text : '';
      
      // Road: Address feature
      const road = address.text || address.properties?.address || '';
      
      // Neighborhood: Colloquial sub-city feature
      // Priority: context > direct feature
      const neighbourhoodName = neighborhoodFromContext.text || neighborhood.text || '';
      
      // CITY: 'place' type in context array (cities, villages, municipalities)
      // According to Mapbox docs: "Typically these are cities, villages, municipalities, etc."
      // This is the main city name (e.g., "Coimbatore", "San Francisco")
      // Priority: context place > direct place feature
      const city = placeFromContext.text || placeFeature.text || '';
      
      // DISTRICT: Administrative level between region and place
      // According to Mapbox docs: "Features that are smaller than top-level administrative features 
      // but typically larger than cities" (e.g., prefectures in China)
      // Only present in some countries, so may be empty
      const district = districtFromContext.text || '';
      
      // STATE/REGION: Top-level sub-national administrative feature
      // According to Mapbox docs: "Top-level sub-national administrative features, 
      // such as states in the United States or provinces in Canada or China"
      // Priority: context region > direct region feature
      const state = regionFromContext.text || region.text || '';
      
      // COUNTRY: From context or feature
      // Priority: context country > direct country feature
      const countryName = countryFromContext.text || country.text || '';
      const countryCode = (countryFromContext.short_code || country.properties?.short_code || '').toUpperCase();
      
      // POSTCODE: Postal code
      // Priority: context postcode > direct postcode feature
      const postcodeValue = postcodeFromContext.text || postcode.text || '';
      
      // Build place name (prioritize institution/building/POI)
      const placeName = institution || building || poi.text || road || neighbourhoodName || city || 'Location';
      
      // Build formatted address with proper hierarchy
      // Order: Road → Neighborhood → City → District → State → Postcode → Country
      const addressParts = [];
      if (institution) addressParts.push(institution);
      if (building && building !== institution) addressParts.push(building);
      if (road && road !== institution && road !== building) addressParts.push(road);
      if (neighbourhoodName && neighbourhoodName !== city && neighbourhoodName !== road) addressParts.push(neighbourhoodName);
      if (city && city !== neighbourhoodName && city !== road) addressParts.push(city); // City is critical - always include if found
      if (district && district !== city && district !== state) addressParts.push(district);
      if (state && state !== district && state !== city) addressParts.push(state);
      if (postcodeValue) addressParts.push(postcodeValue);
      if (countryName) addressParts.push(countryName);
      
      // Initialize geocodedData
      let geocodedData = {
        placeName: placeName,
        formattedAddress: '',
        // Detailed components
        road: road,
        neighbourhood: neighbourhoodName,
        city: city,
        district: district,
        state: state,
        country: countryName,
        countryCode: countryCode,
        postcode: postcodeValue,
        // Additional details
        building: building,
        amenity: poi.properties?.category || '',
        shop: '',
        institution: institution,
        // Coordinates (Mapbox returns exact coordinates)
        lat: data.query?.[1] || lat,
        lon: data.query?.[0] || lng
      };
      
      // If city is still missing, try to extract from place_name
      if (!geocodedData.city && mainFeature.place_name) {
        const placeNameParts = mainFeature.place_name.split(',');
        // Usually format: "Road, Neighborhood, City, State, Postcode, Country"
        // City is typically the 3rd or 4th part (index 2 or 3)
        for (let i = 0; i < placeNameParts.length; i++) {
          const part = placeNameParts[i].trim();
          // Skip if it's a number (postcode) or known values
          if (!/^\d+$/.test(part) && 
              part !== geocodedData.neighbourhood && 
              part !== geocodedData.road && 
              part !== geocodedData.state && 
              part !== geocodedData.country) {
            // Likely the city (usually 3rd or 4th position)
            if (i >= 2 && i <= 3) {
              geocodedData.city = part;
              // Insert city in correct position in addressParts
              const stateIndex = addressParts.findIndex(p => p === geocodedData.state || p === geocodedData.district);
              if (stateIndex > 0 && !addressParts.includes(part)) {
                addressParts.splice(stateIndex, 0, part);
              } else if (!addressParts.includes(part)) {
                // Insert after neighborhood if exists, otherwise before state
                const neighborhoodIndex = addressParts.findIndex(p => p === geocodedData.neighbourhood);
                if (neighborhoodIndex >= 0) {
                  addressParts.splice(neighborhoodIndex + 1, 0, part);
                } else {
                  addressParts.push(part);
                }
              }
              break;
            }
          }
        }
      }
      
      // Build formatted address
      geocodedData.formattedAddress = addressParts.length > 0 
        ? addressParts.join(', ')
        : mainFeature.place_name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;

      console.log('✅ Mapbox geocoding successful!');
      console.log('📍 Geocoded data:', geocodedData);
      console.log('📍 Place:', geocodedData.placeName);
      console.log('📍 Full address:', geocodedData.formattedAddress);
      console.log('📍 City:', geocodedData.city);
      
      return geocodedData;
    } catch (error) {
      console.error('❌ Mapbox geocoding error:', error);
      console.warn('⚠️ Falling back to BigDataCloud...');
      
      // Fallback to BigDataCloud if Mapbox fails
      return await reverseGeocodeWithBigDataCloud(lat, lng);
    }

    /* ====== OPENCAGE CODE (COMMENTED OUT) ======
    try {
      // Get API key from environment
      const apiKey = import.meta.env.VITE_OPENCAGE_API_KEY;
      
      if (!apiKey || apiKey === 'your_opencage_api_key_here') {
        console.warn('⚠️ OpenCage API key not configured, falling back to BigDataCloud');
        return await reverseGeocodeWithBigDataCloud(lat, lng);
      }

      // Using OpenCage Geocoding API - Better accuracy for institutions
      const geocodeUrl = `https://api.opencagedata.com/geocode/v1/json?q=${lat}+${lng}&key=${apiKey}&language=en&pretty=1`;
      console.log('🌐 OpenCage URL:', geocodeUrl.replace(apiKey, 'API_KEY_HIDDEN'));

      const response = await fetch(geocodeUrl);

      console.log('🌐 Geocoding response status:', response.status, response.statusText);

      if (!response.ok) {
        throw new Error(`OpenCage API failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('🌐 Raw OpenCage data:', data);

      if (!data.results || data.results.length === 0) {
        throw new Error('No geocoding results found');
      }

      const result = data.results[0];
      const components = result.components;
      
      console.log('🌐 Address components:', components);
      
      // Extract detailed address information from OpenCage format
      // Priority: building/institution > road > suburb/neighbourhood > city
      const building = components.building || components.shop || components.amenity || '';
      const institution = components.university || components.college || components.school || '';
      const road = components.road || components.pedestrian || '';
      const neighbourhood = components.suburb || components.neighbourhood || components.residential || '';
      const city = components.city || components.town || components.village || components.county || '';
      const district = components.state_district || components.county || '';
      const state = components.state || components.region || '';
      const country = components.country || '';
      const countryCode = components.country_code?.toUpperCase() || '';
      const postcode = components.postcode || '';
      
      // Build place name (prioritize institution/building)
      const placeName = institution || building || road || neighbourhood || city || 'Location';
      
      // Build formatted address with proper hierarchy
      const addressParts = [];
      if (institution) addressParts.push(institution);
      if (building && building !== institution) addressParts.push(building);
      if (road && road !== institution && road !== building) addressParts.push(road);
      if (neighbourhood && neighbourhood !== city) addressParts.push(neighbourhood);
      if (city) addressParts.push(city);
      if (district && district !== city) addressParts.push(district);
      if (state) addressParts.push(state);
      if (postcode) addressParts.push(postcode);
      if (country) addressParts.push(country);
      
      const formattedAddress = addressParts.length > 0 
        ? addressParts.join(', ')
        : result.formatted || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      
      const geocodedData = {
        placeName: placeName,
        formattedAddress: formattedAddress,
        // Detailed components
        road: road,
        neighbourhood: neighbourhood,
        city: city,
        district: district,
        state: state,
        country: country,
        countryCode: countryCode,
        postcode: postcode,
        // Additional details
        building: building,
        amenity: components.amenity || '',
        shop: components.shop || '',
        institution: institution,
        // Coordinates
        lat: result.geometry?.lat || lat,
        lon: result.geometry?.lng || lng
      };

      console.log('✅ OpenCage geocoding successful!');
      console.log('📍 Geocoded data:', geocodedData);
      console.log('📍 Place:', placeName);
      console.log('📍 Full address:', formattedAddress);
      
      return geocodedData;
    } catch (error) {
      console.error('❌ OpenCage geocoding error:', error);
      console.warn('⚠️ Falling back to BigDataCloud...');
      
      // Fallback to BigDataCloud if OpenCage fails
      return await reverseGeocodeWithBigDataCloud(lat, lng);
    }
    ====== END OPENCAGE CODE ====== */
  }, []);

  // Fallback geocoding with BigDataCloud
  const reverseGeocodeWithBigDataCloud = async (lat, lng) => {
    try {
      const geocodeUrl = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`;
      console.log('🌐 Fallback: Using BigDataCloud');

      const response = await fetch(geocodeUrl);
      if (!response.ok) {
        throw new Error(`BigDataCloud failed: ${response.status}`);
      }

      const data = await response.json();
      const admin = data.localityInfo?.administrative || [];
      
      const street = admin.find(item => item.order === 8)?.name || '';
      const locality = admin.find(item => item.order === 7)?.name || data.locality || '';
      const postcode = admin.find(item => item.order === 6)?.name || data.postcode || '';
      const district = admin.find(item => item.order === 5)?.name || '';
      const city = admin.find(item => item.order === 4)?.name || data.city || '';
      const state = admin.find(item => item.order === 3)?.name || data.principalSubdivision || '';
      const country = admin.find(item => item.order === 2)?.name || data.countryName || '';
      
      const addressParts = [];
      if (street) addressParts.push(street);
      if (locality && locality !== city) addressParts.push(locality);
      if (city) addressParts.push(city);
      if (district && district !== city) addressParts.push(district);
      if (state) addressParts.push(state);
      if (postcode) addressParts.push(postcode);
      if (country) addressParts.push(country);
      
      const formattedAddress = addressParts.length > 0 
        ? addressParts.join(', ')
        : `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      
      return {
        placeName: street || locality || city || 'Location',
        formattedAddress: formattedAddress,
        road: street,
        neighbourhood: locality,
        city: city,
        district: district,
        state: state,
        country: country,
        countryCode: data.countryCode || '',
        postcode: postcode,
        building: '',
        amenity: '',
        shop: '',
        institution: '',
        lat: parseFloat(data.latitude || lat),
        lon: parseFloat(data.longitude || lng)
      };
    } catch (fallbackError) {
      console.error('❌ BigDataCloud fallback also failed:', fallbackError);
      
      // Final fallback with coordinates only
      return {
        placeName: 'Location captured',
        formattedAddress: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
        lat,
        lon: lng,
        city: '',
        country: '',
        postcode: '',
        road: '',
        state: '',
        neighbourhood: '',
        district: '',
        countryCode: '',
        building: '',
        amenity: '',
        shop: '',
        institution: ''
      };
    }
  };

  /**
   * Request location permission and get current location with detailed address
   */
  const requestLocation = useCallback(async () => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        const error = new Error('Geolocation is not supported by your browser');
        setError(error.message);
        reject(error);
        return;
      }

      setLoading(true);
      setError(null);

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          console.log('📍 GPS position received:', position);
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          const accuracy = position.coords.accuracy;
          const timestamp = new Date(position.timestamp).toISOString();
          
          console.log('📍 GPS coordinates:', { lat, lng, accuracy, timestamp });
          
          // Get detailed address via reverse geocoding
          console.log('🔄 Calling reverse geocoding...');
          const addressDetails = await reverseGeocode(lat, lng);
          console.log('✅ Reverse geocoding completed');
          
          const locationData = {
            latitude: lat,
            longitude: lng,
            accuracy: accuracy,
            timestamp: timestamp,
            // Address details
            ...addressDetails
          };

          console.log('✅ Final location data object:', locationData);
          console.log('📍 Location data keys:', Object.keys(locationData));

          setCurrentLocation(locationData);
          setLocationPermission('granted');
          setLoading(false);
          resolve(locationData);
        },
        (error) => {
          let errorMessage = 'Failed to get location';
          
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = 'Location access denied';
              setLocationPermission('denied');
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = 'Location information unavailable';
              break;
            case error.TIMEOUT:
              errorMessage = 'Location request timed out';
              break;
            default:
              errorMessage = 'An unknown error occurred';
          }
          
          setError(errorMessage);
          setLoading(false);
          reject(new Error(errorMessage));
        },
        {
          enableHighAccuracy: true,
          timeout: 15000, // Increased timeout for geocoding
          maximumAge: 0
        }
      );
    });
  }, [reverseGeocode]);

  /**
   * Save location permission status to Firestore
   */
  const saveLocationPermission = useCallback(async (granted) => {
    if (!userId) return;

    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        locationAccessGranted: granted,
        locationAccessUpdatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error saving location permission:', error);
    }
  }, [userId]);

  /**
   * Calculate distance between two coordinates (in meters)
   */
  const calculateDistance = useCallback((lat1, lon1, lat2, lon2) => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  }, []);

  /**
   * Check if current location is within radius of target location
   */
  const isWithinRadius = useCallback(
    async (targetLat, targetLon, radiusMeters = 100) => {
      try {
        const location = await requestLocation();
        const distance = calculateDistance(
          location.latitude,
          location.longitude,
          targetLat,
          targetLon
        );

        return {
          isWithin: distance <= radiusMeters,
          distance,
          currentLocation: location
        };
      } catch (error) {
        throw error;
      }
    },
    [requestLocation, calculateDistance]
  );

  return {
    locationPermission,
    currentLocation,
    error,
    loading,
    requestLocation,
    saveLocationPermission,
    calculateDistance,
    isWithinRadius,
    reverseGeocode
  };
};
