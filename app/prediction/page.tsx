"use client";

import { useState } from "react";
import axios from "axios";
import WeatherCard from "../../components/WeatherCard";
import LocationSelector from "../../components/LocationSelector";
import { getSentinelImageUrl } from "../../lib/sentinel";

interface WeatherResponse {
  temp_c: number;
  humidity: number;
  precip_mm: number;
  wind_kph: number;
}

export default function PredictionPage() {
  const [countryCode, setCountryCode] = useState("");
  const [stateCode,   setStateCode]   = useState("");
  const [cityName,    setCityName]    = useState("");
  const [weather,     setWeather]     = useState<WeatherResponse | null>(null);
  const [imgUrl,      setImgUrl]      = useState("");
  const [loading,     setLoading]     = useState(false);

  const canPredict = countryCode && stateCode && cityName;

  const handlePredict = async () => {
    try {
      setLoading(true);

      /* 1 — weather */
      const { data: wx } = await axios.get(
        "https://api.weatherapi.com/v1/current.json",
        { params: { key: process.env.NEXT_PUBLIC_WEATHER_API_KEY, q: cityName } }
      );
      const w = wx.current;
      setWeather({
        temp_c:   w.temp_c,
        humidity: w.humidity,
        precip_mm:w.precip_mm,
        wind_kph: w.wind_kph,
      });

      /* 2 — lat/lon via Nominatim */
      const { data: geo } = await axios.get(
        "https://nominatim.openstreetmap.org/search",
        { params: { city: cityName, country: countryCode, format: "json", limit: 1 } }
      );
      const lat = parseFloat(geo[0].lat);
      const lon = parseFloat(geo[0].lon);

      /* 3 — Sentinel image URL */
      const url = await getSentinelImageUrl(lat, lon);
      setImgUrl(url);
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

        {canPredict && (
          <div className="mt-8 text-center">
            <button
              onClick={handlePredict}
              disabled={loading}
              className="px-10 py-3 bg-gradient-to-r from-cyan-500 to-blue-700 rounded-xl shadow-lg text-white font-semibold hover:scale-105 transition disabled:opacity-50"
            >
              {loading ? "Loading…" : "Predict"}
            </button>
          </div>
        )}

        {(weather || imgUrl) && (
          <section className="mt-12 grid md:grid-cols-2 gap-8">
            {weather && (
              <WeatherCard
                temperature={weather.temp_c}
                humidity={weather.humidity}
                rainfall={weather.precip_mm}
                windspeed={weather.wind_kph}
              />
            )}

            {imgUrl && (
              <div className="rounded-xl overflow-hidden shadow-xl">
                <img
                  src={imgUrl}
                  alt="Satellite view"
                  className="w-full h-auto rounded-xl border-4 border-white"
                />
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
