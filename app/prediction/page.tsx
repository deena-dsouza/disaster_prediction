"use client";

import { useState } from "react";
import axios from "axios";
import WeatherCard from "../../components/WeatherCard";
import LocationSelector from "../../components/LocationSelector";
import { getSentinelImageUrls } from "../../lib/sentinel";

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

  const [s1ImageUrl, setS1ImageUrl] = useState(""); // Flood
  const [s2ImageUrl, setS2ImageUrl] = useState(""); // Landslide

  const [loading, setLoading] = useState(false);
  const [predictionType, setPredictionType] = useState<"flood" | "landslide" | "">("");
  const [predictionResult, setPredictionResult] = useState<{ image_prediction: number; future_prediction: number | null } | null>(null);

  const canPredict = countryCode && stateCode && cityName && predictionType;
  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

  // Convert a blob URL to base64 string
  const toBase64 = (url: string) =>
    fetch(url)
      .then(res => res.blob())
      .then(blob => new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      }));

  const handlePredict = async () => {
    try {
      setLoading(true);
      setPredictionResult(null);

      // 1 — Get weather
      const { data: wx } = await axios.get("https://api.weatherapi.com/v1/current.json", {
        params: { key: process.env.NEXT_PUBLIC_WEATHER_API_KEY, q: cityName },
      });
      const w = wx.current;
      setWeather({
        temp_c: w.temp_c,
        humidity: w.humidity,
        precip_mm: w.precip_mm,
        wind_kph: w.wind_kph,
      });

      // 2 — Get lat/lon
      const { data: geo } = await axios.get("https://nominatim.openstreetmap.org/search", {
        params: { q: `${cityName}, ${stateCode}, ${countryCode}`, format: "json", limit: 1 },
      });
      if (!geo.length) throw new Error("Location not found");
      const lat = parseFloat(geo[0].lat);
      const lon = parseFloat(geo[0].lon);

      // 3 — Get Sentinel images
      const urls = await getSentinelImageUrls(lat, lon);
      setS1ImageUrl(urls.s1Url);
      setS2ImageUrl(urls.s2Url);

      // 4 — Convert images to base64
      const s1Base64 = await toBase64(urls.s1Url);
      const s2Base64 = await toBase64(urls.s2Url);

      // 5 — Prepare payload
      let payload: any = {};
      let endpoint = "";

      if (predictionType === "flood") {
        endpoint = "/predict/flood";
        payload = {
          image_base64: s1Base64,
          // temperature: w.temp_c, // Flood LSTM / TF commented
          // humidity: w.humidity,
          // rainfall: w.precip_mm,
          // windspeed: w.wind_kph,
        };
      } else if (predictionType === "landslide") {
        endpoint = "/predict/landslide";
        payload = {
          image_base64: s2Base64,
          // weather commented
        };
      }

      if (!payload.image_base64) throw new Error("Required satellite image not available");

      const { data } = await axios.post(`${API_URL}${endpoint}`, payload);
      setPredictionResult(data);

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

        <div className="mt-8 mb-6">
          <h3 className="text-xl font-semibold mb-4 text-center">Select Prediction Type</h3>
          <div className="flex flex-col md:flex-row gap-4 justify-center">
            <button
              onClick={() => setPredictionType("flood")}
              className={`px-6 py-3 rounded-xl font-semibold transition-all flex items-center justify-center ${
                predictionType === "flood" ? "bg-blue-600 scale-105" : "bg-blue-800 hover:bg-blue-700"
              }`}
            >
              <span className="mr-2">🌊</span> Flood Prediction
            </button>
            <button
              onClick={() => setPredictionType("landslide")}
              className={`px-6 py-3 rounded-xl font-semibold transition-all flex items-center justify-center ${
                predictionType === "landslide" ? "bg-amber-600 scale-105" : "bg-amber-800 hover:bg-amber-700"
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
              {loading ? "Processing..." : `Predict ${predictionType === "flood" ? "Flood" : "Landslide"}`}
            </button>
          </div>
        )}

        {(weather || s1ImageUrl || s2ImageUrl) && (
          <section className="mt-12 grid md:grid-cols-2 gap-8">
            {s1ImageUrl && (
              <div className="rounded-xl overflow-hidden shadow-xl">
                <h4 className="text-lg font-semibold mb-1 text-center">Sentinel-1 (Flood)</h4>
                <img src={s1ImageUrl} alt="Sentinel-1 Radar" className="w-full h-auto rounded-xl border-4 border-blue-400" />
                <div className="mt-2 text-center text-sm">Sentinel-1 imagery of {cityName}</div>
              </div>
            )}
            {s2ImageUrl && (
              <div className="rounded-xl overflow-hidden shadow-xl">
                <h4 className="text-lg font-semibold mb-1 text-center">Sentinel-2 (Landslide)</h4>
                <img src={s2ImageUrl} alt="Sentinel-2 Optical" className="w-full h-auto rounded-xl border-4 border-green-400" />
                <div className="mt-2 text-center text-sm">Sentinel-2 imagery of {cityName}</div>
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
           {predictionResult && (
  <div className="md:col-span-2 bg-white text-black rounded-xl p-6 shadow-lg text-center">
    <h4 className="text-xl font-semibold mb-2">
      Prediction Result ({predictionType === "flood" ? "Flood" : "Landslide"})
    </h4>

    {/* If backend returns 1/0 */}
    <p className="text-lg">
      Image Prediction: {predictionResult.image_prediction === 1 ? "Yes" : "No"}
    </p> 
    

    
    
  </div>
)}

          </section>
        )}
      </div>
    </div>
  );
}
