"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { feature } from "topojson-client";
import worldTopology from "world-atlas/countries-110m.json";

type Ring = [number, number][];
type CountryShape = { name: string; polygons: Ring[][] };

const atlas = worldTopology as unknown as {
  objects: { countries: object };
};

const countryShapes: CountryShape[] = ((feature(
  atlas as never,
  atlas.objects.countries as never,
) as unknown as { features: Array<{ properties?: { name?: string }; geometry: { type: string; coordinates: unknown } }> }).features).map((item) => ({
  name: item.properties?.name || "",
  polygons: (item.geometry.type === "Polygon"
    ? [item.geometry.coordinates]
    : item.geometry.coordinates) as Ring[][],
}));

const countryAliases: Record<string, string> = {
  "United States": "United States of America",
  "Czechia": "Czech Republic",
  "South Korea": "South Korea",
  "North Korea": "North Korea",
};

type Location = {
  name: string;
  country: string;
  admin1?: string;
  latitude: number;
  longitude: number;
  timezone: string;
};

type ForecastDay = {
  date: string;
  code: number;
  high: number;
  low: number;
  rain: number;
};

type Weather = {
  temperature: number;
  feels: number;
  humidity: number;
  wind: number;
  code: number;
  isDay: boolean;
  sunrise: string;
  sunset: string;
  days: ForecastDay[];
};

const initialLocation: Location = {
  name: "San Francisco",
  country: "United States",
  admin1: "California",
  latitude: 37.7749,
  longitude: -122.4194,
  timezone: "America/Los_Angeles",
};

const initialWeather: Weather = {
  temperature: 64,
  feels: 63,
  humidity: 71,
  wind: 11,
  code: 1,
  isDay: true,
  sunrise: "5:58 AM",
  sunset: "8:31 PM",
  days: [
    { date: "2026-07-14", code: 1, high: 68, low: 55, rain: 2 },
    { date: "2026-07-15", code: 2, high: 67, low: 54, rain: 4 },
    { date: "2026-07-16", code: 1, high: 70, low: 55, rain: 1 },
    { date: "2026-07-17", code: 0, high: 72, low: 56, rain: 0 },
    { date: "2026-07-18", code: 1, high: 69, low: 55, rain: 2 },
  ],
};

const popular = ["Tokyo", "London", "Cape Town", "New York"];

function weatherInfo(code: number) {
  if (code === 0) return { label: "Clear sky", icon: "☀" };
  if (code <= 2) return { label: "Mostly clear", icon: "◒" };
  if (code === 3) return { label: "Overcast", icon: "☁" };
  if (code === 45 || code === 48) return { label: "Foggy", icon: "≋" };
  if (code >= 51 && code <= 67) return { label: "Rain", icon: "☂" };
  if (code >= 71 && code <= 77) return { label: "Snow", icon: "✣" };
  if (code >= 80 && code <= 82) return { label: "Showers", icon: "☂" };
  if (code >= 95) return { label: "Thunderstorms", icon: "ϟ" };
  return { label: "Partly cloudy", icon: "◒" };
}

function formatTime(value: string, timezone: string) {
  return new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
  }).format(new Date(value));
}

function Globe({ location }: { location: Location }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewRef = useRef({ lat: initialLocation.latitude, lon: initialLocation.longitude });
  const targetRef = useRef({ lat: location.latitude, lon: location.longitude, country: location.country });
  const animationRef = useRef(0);
  const [settled, setSettled] = useState(true);

  useEffect(() => {
    targetRef.current = { lat: location.latitude, lon: location.longitude, country: location.country };
    setSettled(false);
    const timer = window.setTimeout(() => setSettled(true), 1150);
    return () => window.clearTimeout(timer);
  }, [location.latitude, location.longitude, location.country]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const width = rect.width;
      const height = rect.height;
      const radius = Math.min(width, height) * 0.405;
      const cx = width / 2;
      const cy = height / 2 + 3;
      const target = targetRef.current;
      const view = viewRef.current;
      let lonDelta = ((target.lon - view.lon + 540) % 360) - 180;
      view.lon += lonDelta * 0.045;
      view.lat += (target.lat - view.lat) * 0.045;

      ctx.clearRect(0, 0, width, height);
      const glow = ctx.createRadialGradient(cx - radius * .3, cy - radius * .38, radius * .08, cx, cy, radius * 1.25);
      glow.addColorStop(0, "#dfece8");
      glow.addColorStop(.58, "#8fb3aa");
      glow.addColorStop(1, "#355f56");
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fillStyle = glow;
      ctx.fill();
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.clip();

      const project = (lat: number, lon: number) => {
        const p = lat * Math.PI / 180;
        const l = (lon - view.lon) * Math.PI / 180;
        const p0 = view.lat * Math.PI / 180;
        const x = Math.cos(p) * Math.sin(l);
        const y = Math.cos(p0) * Math.sin(p) - Math.sin(p0) * Math.cos(p) * Math.cos(l);
        const z = Math.sin(p0) * Math.sin(p) + Math.cos(p0) * Math.cos(p) * Math.cos(l);
        return { x: cx + x * radius, y: cy - y * radius, z };
      };

      ctx.strokeStyle = "rgba(244, 242, 235, .24)";
      ctx.lineWidth = 1;
      for (let lat = -60; lat <= 60; lat += 30) {
        ctx.beginPath();
        let begun = false;
        for (let lon = -180; lon <= 180; lon += 3) {
          const p = project(lat, lon);
          if (p.z > 0) { begun ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); begun = true; }
          else begun = false;
        }
        ctx.stroke();
      }
      for (let lon = -180; lon < 180; lon += 30) {
        ctx.beginPath();
        let begun = false;
        for (let lat = -88; lat <= 88; lat += 3) {
          const p = project(lat, lon);
          if (p.z > 0) { begun ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); begun = true; }
          else begun = false;
        }
        ctx.stroke();
      }
      const selectedCountry = countryAliases[target.country] || target.country;
      countryShapes.forEach((country) => {
        const isSelected = country.name === selectedCountry;
        country.polygons.forEach((polygon) => {
          polygon.forEach((ring) => {
            ctx.beginPath();
            let begun = false;
            let visiblePoints = 0;
            ring.forEach(([lon, lat]) => {
              const p = project(lat, lon);
              if (p.z > .015) {
                begun ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y);
                begun = true;
                visiblePoints += 1;
              } else {
                begun = false;
              }
            });
            if (visiblePoints < 2) return;
            ctx.closePath();
            ctx.fillStyle = isSelected ? "rgba(232, 95, 55, .88)" : "rgba(238, 235, 222, .9)";
            ctx.fill();
            ctx.strokeStyle = isSelected ? "rgba(255, 255, 255, .98)" : "rgba(23, 53, 47, .46)";
            ctx.lineWidth = isSelected ? 2 : .7;
            ctx.stroke();
          });
        });
      });

      const exactPoint = project(target.lat, target.lon);
      if (exactPoint.z > 0) {
        const halo = ctx.createRadialGradient(exactPoint.x, exactPoint.y, 2, exactPoint.x, exactPoint.y, 30);
        halo.addColorStop(0, "rgba(255,255,255,.95)");
        halo.addColorStop(.24, "rgba(232,95,55,.42)");
        halo.addColorStop(1, "rgba(232,95,55,0)");
        ctx.beginPath();
        ctx.arc(exactPoint.x, exactPoint.y, 30, 0, Math.PI * 2);
        ctx.fillStyle = halo;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(exactPoint.x, exactPoint.y, 9, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(255,255,255,.95)";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      ctx.restore();
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,255,255,.7)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      animationRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(animationRef.current);
  }, []);

  return (
    <div className="globe-wrap" aria-label={`Globe centered on ${location.name} at ${location.latitude.toFixed(2)}, ${location.longitude.toFixed(2)}`}>
      <div className="orbit orbit-one" />
      <div className="orbit orbit-two" />
      <canvas ref={canvasRef} className="globe-canvas" />
      <div className={`target-reticle ${settled ? "is-settled" : ""}`} aria-hidden="true"><i /><i /></div>
      <div className={`target-connector ${settled ? "is-settled" : ""}`} aria-hidden="true" />
      <div className={`map-pin ${settled ? "is-settled" : ""}`} aria-hidden="true">
        <span />
      </div>
      <div className={`location-tag ${settled ? "is-settled" : ""}`}>
        <small>Pinpointed location</small>
        <strong>{location.name}</strong>
        <span className="location-country">{[location.admin1, location.country].filter(Boolean).join(", ")}</span>
        <span className="location-coordinates">{Math.abs(location.latitude).toFixed(2)}°{location.latitude >= 0 ? "N" : "S"} · {Math.abs(location.longitude).toFixed(2)}°{location.longitude >= 0 ? "E" : "W"}</span>
      </div>
    </div>
  );
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState(initialLocation);
  const [weather, setWeather] = useState(initialWeather);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const info = weatherInfo(weather.code);

  const loadWeather = async (place: Location) => {
    const params = new URLSearchParams({
      latitude: String(place.latitude),
      longitude: String(place.longitude),
      current: "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m",
      daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset",
      temperature_unit: "fahrenheit",
      wind_speed_unit: "mph",
      timezone: "auto",
      forecast_days: "7",
    });
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
    if (!response.ok) throw new Error("Weather data is unavailable right now.");
    const data = await response.json();
    setWeather({
      temperature: Math.round(data.current.temperature_2m),
      feels: Math.round(data.current.apparent_temperature),
      humidity: Math.round(data.current.relative_humidity_2m),
      wind: Math.round(data.current.wind_speed_10m),
      code: data.current.weather_code,
      isDay: Boolean(data.current.is_day),
      sunrise: formatTime(data.daily.sunrise[0], data.timezone),
      sunset: formatTime(data.daily.sunset[0], data.timezone),
      days: data.daily.time.slice(0, 5).map((date: string, i: number) => ({
        date,
        code: data.daily.weather_code[i],
        high: Math.round(data.daily.temperature_2m_max[i]),
        low: Math.round(data.daily.temperature_2m_min[i]),
        rain: Math.round(data.daily.precipitation_probability_max[i] || 0),
      })),
    });
  };

  const search = async (name: string) => {
    if (name.trim().length < 2) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1&language=en&format=json`);
      if (!response.ok) throw new Error("Location search is unavailable right now.");
      const data = await response.json();
      if (!data.results?.length) throw new Error("We couldn’t find that place. Try a nearby city or country.");
      const result = data.results[0];
      const next: Location = {
        name: result.name,
        country: result.country,
        admin1: result.admin1,
        latitude: result.latitude,
        longitude: result.longitude,
        timezone: result.timezone,
      };
      await loadWeather(next);
      setLocation(next);
      setQuery("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    search(query);
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Meridian home">
          <span className="brand-mark"><i /><i /><i /></span>
          <span>meridian</span>
        </a>
        <div className="status"><span /> Live global weather</div>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow">Weather, made clear</p>
          <h1>Know the weather.<br /><em>Anywhere.</em></h1>
          <p className="intro">Search any place in the world and see what the day has in store—without the clutter.</p>
          <form className="search" onSubmit={submit}>
            <span className="search-icon" aria-hidden="true" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search a city or country"
              aria-label="Search a city or country"
              autoComplete="off"
            />
            <button disabled={loading || query.trim().length < 2} type="submit">
              {loading ? <span className="spinner" /> : "Explore"}
            </button>
          </form>
          <div className="search-meta">
            <span>Popular</span>
            {popular.map((city) => <button key={city} onClick={() => search(city)}>{city}</button>)}
          </div>
          {error && <p className="error" role="alert">{error}</p>}
        </div>

        <div className="globe-panel">
          <div className="globe-kicker"><span>01</span> Live location</div>
          <Globe location={location} />
          <p className="globe-note">The globe turns to your selected location</p>
        </div>
      </section>

      <section className="weather-section" aria-live="polite" aria-busy={loading}>
        <div className="location-heading">
          <div>
            <p className="eyebrow">Right now</p>
            <h2>{location.name}</h2>
            <p>{[location.admin1, location.country].filter(Boolean).join(", ")}</p>
          </div>
          <p className="local-date">{new Intl.DateTimeFormat("en", { weekday: "long", month: "long", day: "numeric", timeZone: location.timezone }).format(new Date())}</p>
        </div>

        <div className="weather-grid">
          <article className="current-card">
            <div className="condition-icon" aria-hidden="true">{info.icon}</div>
            <div className="temperature">{weather.temperature}<sup>°</sup></div>
            <div className="condition-copy">
              <strong>{info.label}</strong>
              <span>Feels like {weather.feels}°</span>
            </div>
            <div className="current-details">
              <div><span>Humidity</span><strong>{weather.humidity}%</strong></div>
              <div><span>Wind</span><strong>{weather.wind} mph</strong></div>
              <div><span>Sunrise</span><strong>{weather.sunrise}</strong></div>
              <div><span>Sunset</span><strong>{weather.sunset}</strong></div>
            </div>
          </article>

          <article className="forecast-card">
            <div className="card-title"><span>5-day outlook</span><small>High / Low</small></div>
            <div className="forecast-list">
              {weather.days.map((day, index) => {
                const dayInfo = weatherInfo(day.code);
                return (
                  <div className="forecast-row" key={day.date}>
                    <strong>{index === 0 ? "Today" : new Intl.DateTimeFormat("en", { weekday: "short", timeZone: "UTC" }).format(new Date(`${day.date}T12:00:00Z`))}</strong>
                    <span className="forecast-condition"><i>{dayInfo.icon}</i>{dayInfo.label}</span>
                    <span className="rain">{day.rain}% rain</span>
                    <span className="temps"><b>{day.high}°</b> {day.low}°</span>
                  </div>
                );
              })}
            </div>
          </article>
        </div>
      </section>

      <footer>
        <span>Meridian</span>
        <p>Clear weather, wherever you are.</p>
        <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Data by Open-Meteo ↗</a>
      </footer>
    </main>
  );
}
