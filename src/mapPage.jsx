
import { useEffect, useState, useRef } from 'react'
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMap,
} from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { getData } from './api'
import './App.css'

const makeIcon = (color) =>
  L.divIcon({
    className: '',
    html: `<div style="background:${color};width:18px;height:18px;border:3px solid white;border-radius:50%;box-shadow:0 1px 5px #555"></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  })

const supplierIcon = makeIcon('#237a45')
const vendorIcon = makeIcon('#e58b27')
const currentIcon = makeIcon('#1677ff')
const destinationIcon = makeIcon('#d62828')

function FitMarkers({ locations }) {
  const map = useMap()

  useEffect(() => {
    if (locations.length > 0) {
      map.fitBounds(L.latLngBounds(locations), {
        padding: [40, 40],
        maxZoom: 13,
      })
    }
  }, [locations, map])

  return null
}

function MapPage() {
  const [suppliers, setSuppliers] = useState([])
  const [vendors, setVendors] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [search, setSearch] = useState('')
  const [results, setResults] = useState([])
  const [destination, setDestination] = useState(null)
  const [position, setPosition] = useState(null)
  const [mode, setMode] = useState('car')
  const [route, setRoute] = useState([])
  const [directions, setDirections] = useState([])
  const [distance, setDistance] = useState(null)
  const [duration, setDuration] = useState(null)
  const [message, setMessage] = useState('')
  const [searching, setSearching] = useState(false)
  const [navigating, setNavigating] = useState(false)
  const [showNavigationModal, setShowNavigationModal] =
    useState(false)
  const [preparingRoute, setPreparingRoute] = useState(false)

  const watchId = useRef(null)
  const arrived = useRef(false)
  const lastRouteTime = useRef(0)

  async function loadLocations() {
    try {
      setLoading(true)
      setError('')

      const [supplierData, vendorData] = await Promise.all([
        getData('suppliers'),
        getData('street-vendors'),
      ])

      setSuppliers(Array.isArray(supplierData) ? supplierData : [])
      setVendors(Array.isArray(vendorData) ? vendorData : [])
    } catch (err) {
      setError(err.message || 'Could not load locations.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadLocations()
  }, [])

  useEffect(() => {
    if (search.trim().length < 3 || destination?.name === search) {
      setResults([])
      return
    }

    const controller = new AbortController()

    const timer = setTimeout(async () => {
      setSearching(true)

      try {
        const url =
          'https://nominatim.openstreetmap.org/search?' +
          new URLSearchParams({
            q: search.trim(),
            format: 'jsonv2',
            limit: '6',
            addressdetails: '1',
          })

        const response = await fetch(url, {
          signal: controller.signal,
        })

        if (!response.ok) {
          throw new Error('Search failed.')
        }

        const data = await response.json()

        setResults(
          data.map((place) => ({
            name: place.display_name,
            lat: Number(place.lat),
            lon: Number(place.lon),
          }))
        )
      } catch (err) {
        if (err.name !== 'AbortError') {
          setMessage(
            'Place search failed. Check your internet connection.'
          )
        }
      } finally {
        if (!controller.signal.aborted) {
          setSearching(false)
        }
      }
    }, 1000)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [search, destination])

  function selectDestination(place) {
    setDestination(place)
    setSearch(place.name)
    setResults([])
    setRoute([])
    setDirections([])
    setDistance(null)
    setDuration(null)
    setShowNavigationModal(false)
    arrived.current = false
    setMessage('Destination selected. Choose Drive or Walk.')
  }

  function stopNavigation() {
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current)
      watchId.current = null
    }

    setNavigating(false)
    setMessage('Navigation stopped.')
  }

  function getCurrentPosition() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Your browser does not support GPS.'))
        return
      }

      navigator.geolocation.getCurrentPosition(
        (location) =>
          resolve({
            lat: location.coords.latitude,
            lon: location.coords.longitude,
            accuracy: location.coords.accuracy,
          }),
        reject,
        {
          enableHighAccuracy: true,
          timeout: 20000,
          maximumAge: 0,
        }
      )
    })
  }

  async function calculateRoute(start, end, travelMode) {
    const profile = travelMode === 'car' ? 'car' : 'foot'

    const url =
      `https://routing.openstreetmap.de/routed-${profile}/route/v1/${profile}/` +
      `${start.lon},${start.lat};${end.lon},${end.lat}` +
      '?overview=full&geometries=geojson&steps=true'

    const response = await fetch(url)

    if (!response.ok) {
      throw new Error(
        'Routing service is unavailable. Please try again.'
      )
    }

    const data = await response.json()

    if (data.code !== 'Ok' || !data.routes?.length) {
      throw new Error(
        'No route found for this destination and travel mode.'
      )
    }

    const selectedRoute = data.routes[0]

    setRoute(
      selectedRoute.geometry.coordinates.map(([lon, lat]) => [
        lat,
        lon,
      ])
    )

    setDistance(selectedRoute.distance)
    setDuration(selectedRoute.duration)

    const steps = selectedRoute.legs.flatMap((leg) =>
      leg.steps.map((step) => {
        const type = step.maneuver?.type
        const modifier = step.maneuver?.modifier

        let action = 'Continue'

        if (type === 'depart') action = 'Start your journey'
        if (type === 'arrive') action = 'You have arrived'
        if (type === 'turn') action = `Turn ${modifier || ''}`

        if (type === 'fork') {
          action = `At the fork, keep ${modifier || 'going'}`
        }

        if (type === 'roundabout' || type === 'rotary') {
          action = 'Enter the roundabout'
        }

        return {
          action,
          road: step.name || '',
          distance: step.distance,
        }
      })
    )

    setDirections(steps)
    lastRouteTime.current = Date.now()
  }

  async function previewRoute(travelMode) {
    if (!destination) {
      setMessage('Search for a destination and select a result first.')
      return
    }

    if (navigating || preparingRoute) {
      return
    }

    setMode(travelMode)
    setPreparingRoute(true)
    setShowNavigationModal(true)
    setMessage('Searching for route... Please wait.')

    try {
      const current = await getCurrentPosition()

      setPosition(current)

      setMessage('Calculating your route and estimated travel time...')

      await calculateRoute(current, destination, travelMode)

      setMessage(
        `Your ${travelMode === 'car' ? 'driving' : 'walking'} route is ready.`
      )
    } catch (err) {
      setMessage(
        err.message ||
          'Could not prepare the route. Check GPS permission and try again.'
      )
    } finally {
      setPreparingRoute(false)
    }
  }

  function speakArrival() {
    if (arrived.current) return

    arrived.current = true
    stopNavigation()
    setShowNavigationModal(true)

    const arrivalMessage =
      'Ho panya-panya, u fihlile moo u eang teng!'

    setMessage(arrivalMessage)

    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()

      const speech = new SpeechSynthesisUtterance(arrivalMessage)
      speech.rate = 0.85
      window.speechSynthesis.speak(speech)
    }

    if ('vibrate' in navigator) {
      navigator.vibrate([300, 150, 300])
    }

    try {
      const AudioContextClass =
        window.AudioContext || window.webkitAudioContext

      if (AudioContextClass) {
        const audio = new AudioContextClass()
        const oscillator = audio.createOscillator()
        const gain = audio.createGain()

        oscillator.connect(gain)
        gain.connect(audio.destination)

        oscillator.frequency.value = 880
        gain.gain.value = 0.15

        oscillator.start()

        setTimeout(() => {
          oscillator.stop()
          audio.close()
        }, 500)
      }
    } catch {
      console.log('Arrival sound unavailable.')
    }
  }

  async function startNavigation() {
    if (!destination) {
      setMessage('Search for a destination and select a result first.')
      return
    }

    if (navigating || preparingRoute) return

    setShowNavigationModal(true)
    setPreparingRoute(true)
    setMessage('Searching for route... Please wait.')

    try {
      const start = await getCurrentPosition()

      setPosition(start)
      arrived.current = false

      setMessage('Calculating your route and estimated travel time...')

      await calculateRoute(start, destination, mode)

      setNavigating(true)
      setMessage('Navigation started. Follow the route on the map.')

      if (watchId.current !== null) {
        navigator.geolocation.clearWatch(watchId.current)
      }

      watchId.current = navigator.geolocation.watchPosition(
        async (location) => {
          const current = {
            lat: location.coords.latitude,
            lon: location.coords.longitude,
            accuracy: location.coords.accuracy,
          }

          setPosition(current)

          const remaining = distanceBetween(
            current.lat,
            current.lon,
            destination.lat,
            destination.lon
          )

          const arrivalRadius = Math.max(
            30,
            Math.min(60, current.accuracy || 30)
          )

          if (remaining <= arrivalRadius) {
            speakArrival()
            return
          }

          if (
            Date.now() - lastRouteTime.current > 30000 &&
            !arrived.current
          ) {
            try {
              await calculateRoute(current, destination, mode)
            } catch (err) {
              console.error('Could not update route:', err)
            }
          }
        },
        (err) => {
          setMessage(
            `GPS tracking error: ${err.message}. Check location permission.`
          )
        },
        {
          enableHighAccuracy: true,
          maximumAge: 2000,
          timeout: 20000,
        }
      )
    } catch (err) {
      setMessage(
        err.message ||
          'Could not prepare navigation. Check GPS permission and internet connection.'
      )
    } finally {
      setPreparingRoute(false)
    }
  }

  useEffect(() => {
    return () => {
      if (watchId.current !== null) {
        navigator.geolocation.clearWatch(watchId.current)
      }

      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }
    }
  }, [])

  function validCoordinates(location) {
    if (
      location.latitude === null ||
      location.latitude === undefined ||
      location.latitude === '' ||
      location.longitude === null ||
      location.longitude === undefined ||
      location.longitude === ''
    ) {
      return false
    }

    const lat = Number(location.latitude)
    const lon = Number(location.longitude)

    return (
      Number.isFinite(lat) &&
      Number.isFinite(lon) &&
      lat >= -90 &&
      lat <= 90 &&
      lon >= -180 &&
      lon <= 180
    )
  }

  const mappedSuppliers = suppliers.filter(validCoordinates)
  const mappedVendors = vendors.filter(validCoordinates)

  const allLocations = [
    ...mappedSuppliers.map((p) => [
      Number(p.latitude),
      Number(p.longitude),
    ]),
    ...mappedVendors.map((p) => [
      Number(p.latitude),
      Number(p.longitude),
    ]),
    ...(position ? [[position.lat, position.lon]] : []),
    ...(destination ? [[destination.lat, destination.lon]] : []),
  ]

  return (
    <div className="panel">
      <div className="panel-heading">
        <div>
          <h3>Worldwide Map and Navigation</h3>
          <p>
            Search places around the world, walk or drive to your
            destination.
          </p>
        </div>

        <button
          type="button"
          className="small-button"
          onClick={loadLocations}
          disabled={loading}
        >
          {loading ? 'Loading...' : 'Refresh Map'}
        </button>
      </div>

      <div className="map-search-section">
        <label htmlFor="destination-search">
          <strong>Search for any destination</strong>
        </label>

        <input
          id="destination-search"
          className="map-search-input"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value)
            setDestination(null)
            setResults([])
            setRoute([])
            setDirections([])
            setDistance(null)
            setDuration(null)
            setShowNavigationModal(false)
          }}
          placeholder="Search a town, district, street, shop, country..."
        />

        {searching && <p>Searching...</p>}

        {results.length > 0 && (
          <div className="map-search-results">
            {results.map((place, index) => (
              <button
                key={`${place.lat}-${place.lon}-${index}`}
                type="button"
                className="map-search-result"
                onClick={() => selectDestination(place)}
              >
                {place.name}
              </button>
            ))}
          </div>
        )}

        <div className="map-navigation-controls">
          <div className="map-travel-options">
            <label className="map-travel-option">
              <input
                type="radio"
                name="travelMode"
                checked={mode === 'car'}
                onChange={() => previewRoute('car')}
                disabled={!destination || preparingRoute || navigating}
              />
              <span>Drive</span>
            </label>

            <label className="map-travel-option">
              <input
                type="radio"
                name="travelMode"
                checked={mode === 'foot'}
                onChange={() => previewRoute('foot')}
                disabled={!destination || preparingRoute || navigating}
              />
              <span>Walk</span>
            </label>
          </div>

          <button
            type="button"
            className="small-button"
            onClick={startNavigation}
            disabled={!destination || preparingRoute || navigating}
          >
            {preparingRoute
              ? 'Searching Route...'
              : navigating
                ? 'Navigation Active'
                : 'Start Navigation'}
          </button>

          {navigating && (
            <button
              type="button"
              className="small-button"
              onClick={() => {
                stopNavigation()
                setShowNavigationModal(false)
              }}
            >
              Stop Navigation
            </button>
          )}
        </div>

        {destination && (
          <p>
            <strong>Destination:</strong> {destination.name}
          </p>
        )}

        {message && <p role="status">{message}</p>}

        {distance !== null && (
          <p>
            <strong>Distance:</strong> {(distance / 1000).toFixed(2)} km
            {' | '}
            <strong>Estimated time:</strong> {formatDuration(duration)}
          </p>
        )}
      </div>

      {showNavigationModal && (
        <div
          className="navigation-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="navigation-modal-title"
          onClick={(event) => {
            if (
              event.target === event.currentTarget &&
              !preparingRoute &&
              !navigating
            ) {
              setShowNavigationModal(false)
            }
          }}
        >
          <div className="navigation-modal">
            <div className="navigation-modal-header">
              <h2 id="navigation-modal-title">
                {preparingRoute
                  ? 'Searching for Route...'
                  : navigating
                    ? 'Navigation in Progress'
                    : 'Route Details'}
              </h2>

              <button
                type="button"
                className="navigation-modal-close"
                onClick={() => {
                  if (!preparingRoute) {
                    setShowNavigationModal(false)
                  }
                }}
                disabled={preparingRoute}
                aria-label="Close navigation details"
              >
                ×
              </button>
            </div>

            <div className="navigation-modal-content">
              <p>
                <strong>Destination:</strong>
                <br />
                {destination?.name || 'No destination selected'}
              </p>

              <p>
                <strong>Travel mode:</strong>{' '}
                {mode === 'car' ? 'Driving' : 'Walking'}
              </p>

              {preparingRoute && (
                <div className="route-loading">
                  <span className="route-loading-spinner"></span>
                  <strong>Searching for your route...</strong>
                  <p>
                    Getting your GPS location and calculating the
                    distance and estimated travel time. Please wait.
                  </p>
                </div>
              )}

              {!preparingRoute && (
                <>
                  <p>
                    <strong>Distance:</strong>{' '}
                    {distance !== null
                      ? `${(distance / 1000).toFixed(2)} km`
                      : 'Not available'}
                  </p>

                  <p>
                    <strong>Estimated time:</strong>{' '}
                    {duration !== null
                      ? formatDuration(duration)
                      : 'Not available'}
                  </p>

                  {position && (
                    <p>
                      <strong>GPS accuracy:</strong>{' '}
                      {Math.round(position.accuracy)} metres
                    </p>
                  )}
                </>
              )}

              <p className="navigation-modal-status" role="status">
                {message}
              </p>

              {!preparingRoute && directions.length > 0 && (
                <div className="navigation-modal-directions">
                  <h3>Route Directions</h3>

                  {directions.map((step, index) => (
                    <div
                      key={index}
                      className="navigation-modal-step"
                    >
                      <strong>
                        {index + 1}. {step.action}
                      </strong>

                      {step.road && ` — ${step.road}`}

                      <div className="navigation-modal-step-distance">
                        {formatDistance(step.distance)}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="navigation-modal-actions">
                {!navigating && !preparingRoute && (
                  <button
                    type="button"
                    className="small-button"
                    onClick={startNavigation}
                    disabled={!destination}
                  >
                    Start Navigation
                  </button>
                )}

                {navigating && (
                  <button
                    type="button"
                    className="navigation-modal-stop"
                    onClick={() => {
                      stopNavigation()
                      setShowNavigationModal(false)
                    }}
                  >
                    Stop Navigation
                  </button>
                )}

                {!preparingRoute && (
                  <button
                    type="button"
                    className="small-button"
                    onClick={() => setShowNavigationModal(false)}
                  >
                    Close Details
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="map-location-counts">
        <span>
          <span className="supplier-dot">●</span>{' '}
          Suppliers: {mappedSuppliers.length}
        </span>

        <span>
          <span className="vendor-dot">●</span>{' '}
          Street Vendors: {mappedVendors.length}
        </span>
      </div>

      {error && (
        <div className="map-error" role="alert">
          {error}
        </div>
      )}

      {!loading && !error && allLocations.length === 0 && (
        <p>No supplier/vendor coordinates are available yet.</p>
      )}

      <div className="map-container">
        <MapContainer
          center={[-29.31, 27.48]}
          zoom={8}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution="&copy; OpenStreetMap contributors"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <FitMarkers locations={allLocations} />

          {mappedSuppliers.map((supplier) => (
            <Marker
              key={`supplier-${supplier.supplier_id}`}
              position={[
                Number(supplier.latitude),
                Number(supplier.longitude),
              ]}
              icon={supplierIcon}
            >
              <Popup>
                <strong>Supplier</strong>
                <br />
                {supplier.supplier_name}
                <br />
                {supplier.address || 'No address provided'}
              </Popup>
            </Marker>
          ))}

          {mappedVendors.map((vendor) => (
            <Marker
              key={`vendor-${vendor.vendor_id}`}
              position={[
                Number(vendor.latitude),
                Number(vendor.longitude),
              ]}
              icon={vendorIcon}
            >
              <Popup>
                <strong>Street Vendor</strong>
                <br />
                {vendor.vendor_name}
                <br />
                {vendor.address || 'No address provided'}
              </Popup>
            </Marker>
          ))}

          {position && (
            <Marker
              position={[position.lat, position.lon]}
              icon={currentIcon}
            >
              <Popup>Your current location</Popup>
            </Marker>
          )}

          {destination && (
            <Marker
              position={[destination.lat, destination.lon]}
              icon={destinationIcon}
            >
              <Popup>{destination.name}</Popup>
            </Marker>
          )}

          {route.length > 0 && (
            <Polyline
              positions={route}
              pathOptions={{ color: '#1677ff', weight: 6 }}
            />
          )}
        </MapContainer>
      </div>
    </div>
  )
}

function distanceBetween(lat1, lon1, lat2, lon2) {
  const radians = (value) => (value * Math.PI) / 180
  const earthRadius = 6371000

  const dLat = radians(lat2 - lat1)
  const dLon = radians(lon2 - lon1)

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(lat1)) *
      Math.cos(radians(lat2)) *
      Math.sin(dLon / 2) ** 2

  return (
    earthRadius *
    2 *
    Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  )
}

function formatDistance(meters) {
  return meters < 1000
    ? `${Math.round(meters)} metres`
    : `${(meters / 1000).toFixed(1)} km`
}

function formatDuration(seconds) {
  if (seconds === null || seconds === undefined) {
    return 'Calculating...'
  }

  const minutes = Math.round(seconds / 60)

  if (minutes < 60) {
    return `${minutes} minutes`
  }

  return `${Math.floor(minutes / 60)} hr ${minutes % 60} min`
}

export default MapPage
