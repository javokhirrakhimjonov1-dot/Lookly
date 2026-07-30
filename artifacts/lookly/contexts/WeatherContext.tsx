import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export interface WeatherAlert {
  type: "temperature_drop" | "temperature_rise" | "rain_incoming" | "snow_incoming";
  title: string;
  message: string;
  degreeShift?: number;
}

export interface WeatherData {
  temperature: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  rainProbability: number;
  uvIndex: number;
  weatherCode: number;
  condition: string;
  conditionDetail: string;
  city: string;
  isLoading: boolean;
  error: string | null;
  weatherAlert: WeatherAlert | null;
  dismissAlert: () => void;
  refresh: () => void;
  setManualLocation: (query: string) => Promise<{ error?: string }>;
  useCurrentLocation: () => Promise<void>;
}

const TASHKENT = { lat: 41.2995, lon: 69.2401 };
const ALERT_DISMISSED_KEY = "@lookly_alert_dismissed";
const MANUAL_LOCATION_KEY = "@lookly_manual_weather_location";

type SavedLocation = { city: string; lat: number; lon: number };

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

function buildAlert(
  todayMax: number,
  tomorrowMax: number,
  tomorrowCode: number
): WeatherAlert | null {
  const diff = tomorrowMax - todayMax;
  const isRainTomorrow = tomorrowCode >= 51 && tomorrowCode <= 82;
  const isSnowTomorrow = tomorrowCode >= 71 && tomorrowCode <= 77;

  if (isSnowTomorrow && tomorrowCode < 71) return null;
  if (isSnowTomorrow) {
    return {
      type: "snow_incoming",
      title: "Snow forecast tomorrow",
      message: `Bundle up — snow is expected tomorrow. Prep your heavy coat and waterproof boots tonight.`,
    };
  }
  if (isRainTomorrow) {
    return {
      type: "rain_incoming",
      title: "Rain incoming tomorrow",
      message: `Rain is forecast tomorrow. Grab a waterproof jacket or raincoat before you head out.`,
    };
  }
  if (diff <= -5) {
    return {
      type: "temperature_drop",
      title: `${Math.abs(Math.round(diff))}° colder tomorrow`,
      message: `A sudden cold drop is coming. Plan a heavier outfit — your light layers won't be enough.`,
      degreeShift: Math.round(diff),
    };
  }
  if (diff >= 5) {
    return {
      type: "temperature_rise",
      title: `${Math.round(diff)}° warmer tomorrow`,
      message: `It'll be much hotter tomorrow. Switch to breathable fabrics and leave the heavy coat at home.`,
      degreeShift: Math.round(diff),
    };
  }
  return null;
}

const WeatherContext = createContext<WeatherData | null>(null);

export function WeatherProvider({ children }: { children: React.ReactNode }) {
  const [temperature, setTemperature] = useState(22);
  const [feelsLike, setFeelsLike] = useState(22);
  const [humidity, setHumidity] = useState(40);
  const [windSpeed, setWindSpeed] = useState(10);
  const [rainProbability, setRainProbability] = useState(0);
  const [uvIndex, setUvIndex] = useState(0);
  const [weatherCode, setWeatherCode] = useState(0);
  const [city, setCity] = useState("Tashkent");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [weatherAlert, setWeatherAlert] = useState<WeatherAlert | null>(null);
  const [alertDismissedKey, setAlertDismissedKey] = useState<string | null>(null);

  const dismissAlert = useCallback(async () => {
    if (alertDismissedKey) {
      await AsyncStorage.setItem(ALERT_DISMISSED_KEY, alertDismissedKey);
    }
    setWeatherAlert(null);
  }, [alertDismissedKey]);

  const requestWeather = useCallback(async ({ lat, lon, city: locationName }: SavedLocation) => {
    setIsLoading(true);
    setError(null);
    try {
      setCity(locationName);

      const currentUrl =
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
        "&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code" +
        "&daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max,uv_index_max" +
        "&timezone=auto&forecast_days=3";

      const res = await fetch(currentUrl);
      const data = await res.json();

      const c = data.current;
      setTemperature(Math.round(c.temperature_2m));
      setFeelsLike(Math.round(c.apparent_temperature));
      setHumidity(Math.round(c.relative_humidity_2m));
      setWindSpeed(Math.round(c.wind_speed_10m));
      setWeatherCode(c.weather_code);

      if (data.daily) {
        const todayMax = data.daily.temperature_2m_max?.[0] ?? c.temperature_2m;
        const tomorrowMax = data.daily.temperature_2m_max?.[1] ?? c.temperature_2m;
        const tomorrowCode = data.daily.weather_code?.[1] ?? c.weather_code;
        setRainProbability(Math.round(data.daily.precipitation_probability_max?.[0] ?? 0));
        setUvIndex(Math.round(data.daily.uv_index_max?.[0] ?? 0));
        const alert = buildAlert(todayMax, tomorrowMax, tomorrowCode);

        if (alert) {
          const key = `${alert.type}_${Math.round(tomorrowMax)}`;
          setAlertDismissedKey(key);
          const dismissed = await AsyncStorage.getItem(ALERT_DISMISSED_KEY);
          if (dismissed !== key) {
            setWeatherAlert(alert);
          }
        }
      }
    } catch {
      setError("Could not fetch weather");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchWeather = useCallback(async () => {
    const saved = await AsyncStorage.getItem(MANUAL_LOCATION_KEY);
    if (saved) {
      try {
        await requestWeather(JSON.parse(saved) as SavedLocation);
        return;
      } catch {
        await AsyncStorage.removeItem(MANUAL_LOCATION_KEY);
      }
    }

    let location: SavedLocation = { ...TASHKENT, city: "Tashkent" };
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status === "granted") {
        const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        location = { lat: current.coords.latitude, lon: current.coords.longitude, city: "Your location" };
      }
    } catch {
      // Tashkent remains the safe fallback when location services are unavailable.
    }
    await requestWeather(location);
  }, [requestWeather]);

  const setManualLocation = useCallback(async (query: string): Promise<{ error?: string }> => {
    const name = query.trim();
    if (!name) return { error: "Enter a city or town first." };
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1&language=en&format=json`,
      );
      const result = await response.json();
      const match = result.results?.[0];
      if (!match) return { error: "We could not find that location. Try a city name." };
      const location: SavedLocation = {
        city: [match.name, match.country].filter(Boolean).join(", "),
        lat: match.latitude,
        lon: match.longitude,
      };
      await AsyncStorage.setItem(MANUAL_LOCATION_KEY, JSON.stringify(location));
      await requestWeather(location);
      return {};
    } catch {
      return { error: "We could not update the location. Check your connection and try again." };
    } finally {
      setIsLoading(false);
    }
  }, [requestWeather]);

  const useCurrentLocation = useCallback(async () => {
    await AsyncStorage.removeItem(MANUAL_LOCATION_KEY);
    await fetchWeather();
  }, [fetchWeather]);

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
        rainProbability,
        uvIndex,
        weatherCode,
        condition,
        conditionDetail: detail,
        city,
        isLoading,
        error,
        weatherAlert,
        dismissAlert,
        refresh: fetchWeather,
        setManualLocation,
        useCurrentLocation,
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
