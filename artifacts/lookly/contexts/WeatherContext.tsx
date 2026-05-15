import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export interface WeatherData {
  temperature: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  weatherCode: number;
  condition: string;
  conditionDetail: string;
  city: string;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

function getCondition(code: number): { condition: string; detail: string } {
  if (code === 0) return { condition: "Sunny", detail: "Clear sky" };
  if (code <= 3) return { condition: "Cloudy", detail: "Partly cloudy" };
  if (code <= 48) return { condition: "Foggy", detail: "Fog" };
  if (code <= 57) return { condition: "Drizzle", detail: "Light drizzle" };
  if (code <= 67) return { condition: "Rainy", detail: "Rain showers" };
  if (code <= 77) return { condition: "Snowy", detail: "Snow" };
  if (code <= 82) return { condition: "Rainy", detail: "Heavy showers" };
  if (code <= 99) return { condition: "Stormy", detail: "Thunderstorm" };
  return { condition: "Clear", detail: "Unknown" };
}

const WeatherContext = createContext<WeatherData | null>(null);

export function WeatherProvider({ children }: { children: React.ReactNode }) {
  const [temperature, setTemperature] = useState(22);
  const [feelsLike, setFeelsLike] = useState(22);
  const [humidity, setHumidity] = useState(40);
  const [windSpeed, setWindSpeed] = useState(10);
  const [weatherCode, setWeatherCode] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWeather = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const url =
        "https://api.open-meteo.com/v1/forecast?latitude=41.2995&longitude=69.2401" +
        "&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code" +
        "&timezone=Asia/Tashkent&forecast_days=1";
      const res = await fetch(url);
      const data = await res.json();
      const c = data.current;
      setTemperature(Math.round(c.temperature_2m));
      setFeelsLike(Math.round(c.apparent_temperature));
      setHumidity(Math.round(c.relative_humidity_2m));
      setWindSpeed(Math.round(c.wind_speed_10m));
      setWeatherCode(c.weather_code);
    } catch {
      setError("Could not fetch weather");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWeather();
  }, [fetchWeather]);

  const { condition, detail } = getCondition(weatherCode);

  return (
    <WeatherContext.Provider
      value={{
        temperature,
        feelsLike,
        humidity,
        windSpeed,
        weatherCode,
        condition,
        conditionDetail: detail,
        city: "Tashkent",
        isLoading,
        error,
        refresh: fetchWeather,
      }}
    >
      {children}
    </WeatherContext.Provider>
  );
}

export function useWeather() {
  const ctx = useContext(WeatherContext);
  if (!ctx) throw new Error("useWeather must be inside WeatherProvider");
  return ctx;
}
