export type WeatherContext = {
  location: string;
  context: string;
};

const GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";

const WEATHER_WORDS =
  /weather|mausam|मौसम|temperature|temp|forecast|humidity|wind|बारिश|बारिस|हवा|तापमान/i;

const WEATHER_CODES: Record<number, string> = {
  0: "clear sky",
  1: "mainly clear",
  2: "partly cloudy",
  3: "overcast",
  45: "foggy",
  48: "depositing rime fog",
  51: "light drizzle",
  53: "drizzle",
  55: "heavy drizzle",
  61: "light rain",
  63: "rain",
  65: "heavy rain",
  71: "light snow",
  73: "snow",
  75: "heavy snow",
  80: "light rain showers",
  81: "rain showers",
  82: "heavy rain showers",
  95: "thunderstorm",
  96: "thunderstorm with light hail",
  99: "thunderstorm with heavy hail",
};

type GeocodingResponse = {
  results?: Array<{
    name: string;
    country?: string;
    latitude: number;
    longitude: number;
    timezone?: string;
  }>;
};

type ForecastResponse = {
  current?: {
    temperature_2m?: number;
    relative_humidity_2m?: number;
    weather_code?: number;
    wind_speed_10m?: number;
  };
  daily?: {
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
    weather_code?: number[];
    wind_speed_10m_max?: number[];
  };
};

export function isWeatherQuestion(content: string) {
  return WEATHER_WORDS.test(content);
}

function extractLocation(content: string) {
  const query = content.trim().replace(/[?!.]+$/g, "");
  const locationPatterns = [
    /(?:\bin\b|\bat\b|\bfor\b)\s+(.+?)(?:\s+(?:weather|mausam|मौसम|temperature|temp|forecast|tomorrow|today|kal|aaj)\b|$)/i,
    /^(.+?)\s+(?:ka|ki|ke)\s+(?:(?:aaj|kal|today|tomorrow)\s+)?(?:ka|ki|ke\s+)?(?:mausam|weather|temperature|temp|forecast)\b/i,
    /^(.+?)\s+(?:weather|mausam|मौसम|temperature|temp|forecast)\b/i,
  ];

  for (const pattern of locationPatterns) {
    const match = query.match(pattern);
    if (match?.[1]) {
      const candidate = match[1]
        .replace(/\b(?:aaj|kal|today|tomorrow|ka|ki|ke)\b/gi, "")
        .trim();
      if (candidate.length > 1) return candidate;
    }
  }

  return "Riyadh";
}

function isTomorrowQuestion(content: string) {
  return /\btomorrow\b|\bkal\b|कल/i.test(content);
}

function formatNumber(value: number | undefined, suffix: string) {
  return typeof value === "number" ? `${Math.round(value)}${suffix}` : "unavailable";
}

async function getJson<T>(url: string) {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
  });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(
      `Weather provider returned HTTP ${response.status}: ${body.slice(0, 1000)}`,
    );
  }
  try {
    return JSON.parse(body) as T;
  } catch {
    throw new Error("Weather provider returned invalid JSON.");
  }
}

export async function fetchWeatherContext(content: string): Promise<WeatherContext> {
  const locationQuery = extractLocation(content);
  const geocodeUrl = new URL(GEOCODING_URL);
  geocodeUrl.searchParams.set("name", locationQuery);
  geocodeUrl.searchParams.set("count", "1");
  geocodeUrl.searchParams.set("language", "en");
  geocodeUrl.searchParams.set("format", "json");

  const geocoding = await getJson<GeocodingResponse>(geocodeUrl.toString());
  const place = geocoding.results?.[0];
  if (!place) {
    throw new Error(`Weather location not found: ${locationQuery}`);
  }

  const forecastUrl = new URL(FORECAST_URL);
  forecastUrl.searchParams.set("latitude", String(place.latitude));
  forecastUrl.searchParams.set("longitude", String(place.longitude));
  forecastUrl.searchParams.set(
    "current",
    "temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m",
  );
  forecastUrl.searchParams.set(
    "daily",
    "temperature_2m_max,temperature_2m_min,weather_code,wind_speed_10m_max",
  );
  forecastUrl.searchParams.set("forecast_days", "2");
  forecastUrl.searchParams.set("timezone", "auto");

  const forecast = await getJson<ForecastResponse>(forecastUrl.toString());
  const current = forecast.current;
  const daily = forecast.daily;
  const tomorrow = isTomorrowQuestion(content);
  const weather = tomorrow
    ? {
        temperature: `${formatNumber(daily?.temperature_2m_min?.[1], "°C")}–${formatNumber(daily?.temperature_2m_max?.[1], "°C")}`,
        condition: WEATHER_CODES[daily?.weather_code?.[1] ?? -1] ?? "unknown",
        humidity: "not available for tomorrow",
        wind: formatNumber(daily?.wind_speed_10m_max?.[1], " km/h"),
      }
    : {
        temperature: formatNumber(current?.temperature_2m, "°C"),
        condition: WEATHER_CODES[current?.weather_code ?? -1] ?? "unknown",
        humidity: formatNumber(current?.relative_humidity_2m, "%"),
        wind: formatNumber(current?.wind_speed_10m, " km/h"),
      };

  const displayLocation = [place.name, place.country].filter(Boolean).join(", ");
  return {
    location: displayLocation,
    context: [
      `Live weather data for ${displayLocation} from Open-Meteo:`,
      `- ${tomorrow ? "Tomorrow's temperature range" : "Current temperature"}: ${weather.temperature}`,
      `- Condition: ${weather.condition}`,
      `- Humidity: ${weather.humidity}`,
      `- Wind: ${weather.wind}`,
      "Answer the user's weather question using this live data. Reply naturally in the user's language (Hindi, English, or Hinglish).",
    ].join("\n"),
  };
}