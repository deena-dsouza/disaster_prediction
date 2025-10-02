// page.tsx
"use client";

import { useState } from "react";
import axios from "axios";
import WeatherCard from "../../components/WeatherCard";
import LocationSelector from "../../components/LocationSelector";
import { getSentinelImageUrls } from '../../lib/sentinel';

interface WeatherResponse {
  temp_c: number;
  humidity: number;
  precip_mm: number;
  wind_kph: number;
}

export default function PredictionPage() {
  const [countryCode, setCountryCode] = useState("");
  const [stateCode, setStateCode] = useState("");
  const [cityName, setCityName] = useState("");
  const [weather, setWeather] = useState<WeatherResponse | null>(null);
  
  // 1. UPDATED: Two state variables for the two images
  const [s1ImageUrl, setS1ImageUrl] = useState(""); // Sentinel-1 (Radar)
  const [s2ImageUrl, setS2ImageUrl] = useState(""); // Sentinel-2 (Optical)

  const [loading, setLoading] = useState(false);
  const [predictionType, setPredictionType] = useState<"flood" | "landslide" | "">("");

  const canPredict = countryCode && stateCode && cityName && predictionType;

  const handlePredict = async () => {
    try {
      setLoading(true);

      // 1 — weather
      const { data: wx } = await axios.get(
        "https://api.weatherapi.com/v1/current.json",
        { params: { key: process.env.NEXT_PUBLIC_WEATHER_API_KEY, q: cityName } }
      );
      const w = wx.current;
      setWeather({
        temp_c: w.temp_c,
        humidity: w.humidity,
        precip_mm: w.precip_mm,
        wind_kph: w.wind_kph,
      });

      // 2 — lat/lon via Nominatim
      const { data: geo } = await axios.get(
        "https://nominatim.openstreetmap.org/search",
        {
          params: {
            q: `${cityName}, ${stateCode}, ${countryCode}`,
            format: "json",
            limit: 1,
          },
        }
      );

      if (!geo.length) {
        throw new Error("Location not found");
      }
      const lat = parseFloat(geo[0].lat);
      const lon = parseFloat(geo[0].lon);

      // 3 — Sentinel image URLs
      try {
        // CORRECTED: Destructure the two URLs from the result object
        const { s1Url, s2Url } = await getSentinelImageUrls(lat, lon);

        // CORRECTED: Set both URLs to their respective state variables
        setS1ImageUrl(s1Url);
        setS2ImageUrl(s2Url);

      } catch (error) {
        console.error("Failed to load satellite images:", error);
        // Clear old images on failure
        setS1ImageUrl("");
        setS2ImageUrl("");
      }

      // 4 — Placeholder for future prediction API
      console.log(`Making ${predictionType} prediction for ${cityName}`);
      
    } catch (err) {
      console.error("Prediction error:", err);
      alert("See console for details.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[url('/satellite-bg.jpg')] bg-cover bg-center py-10 px-6">
      <div className="max-w-5xl mx-auto bg-black/50 backdrop-blur-lg p-8 rounded-2xl text-white">
        <h2 className="text-4xl font-bold text-center mb-8">🌍 Disaster Prediction</h2>

        <LocationSelector
          countryCode={countryCode}
          setCountryCode={setCountryCode}
          stateCode={stateCode}
          setStateCode={setStateCode}
          cityName={cityName}
          setCityName={setCityName}
        />

        {/* Prediction Type Selection (unchanged) */}
        <div className="mt-8 mb-6">
          <h3 className="text-xl font-semibold mb-4 text-center">Select Prediction Type</h3>
          <div className="flex flex-col md:flex-row gap-4 justify-center">
            <button
              onClick={() => setPredictionType("flood")}
              className={`px-6 py-3 rounded-xl font-semibold transition-all flex items-center justify-center ${
                predictionType === "flood"
                  ? "bg-blue-600 scale-105"
                  : "bg-blue-800 hover:bg-blue-700"
              }`}
            >
              <span className="mr-2">🌊</span> Flood Prediction
            </button>

            <button
              onClick={() => setPredictionType("landslide")}
              className={`px-6 py-3 rounded-xl font-semibold transition-all flex items-center justify-center ${
                predictionType === "landslide"
                  ? "bg-amber-600 scale-105"
                  : "bg-amber-800 hover:bg-amber-700"
              }`}
            >
              <span className="mr-2">⛰</span> Landslide Prediction
            </button>
          </div>
        </div>

        {canPredict && (
          <div className="mt-8 text-center">
            <button
              onClick={handlePredict}
              disabled={loading}
              className="px-10 py-3 bg-gradient-to-r from-cyan-500 to-blue-700 rounded-xl shadow-lg text-white font-semibold hover:scale-105 transition disabled:opacity-50"
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg
                    className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 
                      5.291A7.962 7.962 0 014 12H0c0 3.042 
                      1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Processing...
                </span>
              ) : (
                `Predict ${predictionType === "flood" ? "Flood" : "Landslide"}`
              )}
            </button>
          </div>
        )}

        {/* 2. UPDATED: Display both images and weather card */}
        {(weather || s1ImageUrl || s2ImageUrl) && (
        
          <section className="mt-12 grid md:grid-cols-2 gap-8">
           

            {s1ImageUrl && (
              <div className="rounded-xl overflow-hidden shadow-xl">
                <h4 className="text-lg font-semibold mb-1 text-center">Sentinel-1 (Radar)</h4>
                <img
                  src={s1ImageUrl} // Display S1 image
                  alt="Sentinel-1 Radar view"
                  className="w-full h-auto rounded-xl border-4 border-blue-400"
                />
                <div className="mt-2 text-center text-sm">
                  sentinel-1 imagery of {cityName} 
                </div>
              </div>
            )}
            
            {s2ImageUrl && (
              <div className="rounded-xl overflow-hidden shadow-xl">
                <h4 className="text-lg font-semibold mb-1 text-center">Sentinel-2 (Optical)</h4>
                <img
                  src={s2ImageUrl} // Display S2 image
                  alt="Sentinel-2 Optical view"
                  className="w-full h-auto rounded-xl border-4 border-green-400"
                />
                <div className="mt-2 text-center text-sm">
                 sentinel-2 imagery of {cityName}
                </div>
              </div>
            )}

             {weather && (
              <div className="md:col-span-2 justify-center p-6"> 
                <WeatherCard
                  temperature={weather.temp_c}
                  humidity={weather.humidity}
                  rainfall={weather.precip_mm}
                  windspeed={weather.wind_kph}
                />
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}