import { Router } from "express";
import { getOutfitRecommendations, isCompleteRecommendation } from "../data/recommend";
import type { StoredWardrobeItem } from "../data/wardrobeMap";
import type { WeatherProviderResponse } from "../weather/mapWeather";
import type { UserProfile } from "../engine/weatherEngine";

const router = Router();
const roleFor = (category: string) => category === "accessories" ? "accessory" : category.endsWith("s") ? category.slice(0, -1) : category;
const moodFor = (tags: string[]) => tags.find((tag) => ["casual","minimal","streetwear","formal","sporty","boho","chic"].includes(tag)) ?? "casual";

interface SuggestBody {
  items?: StoredWardrobeItem[]; temperature?: number; weatherCode?: number; humidity?: number;
  windSpeed?: number; windKmh?: number; windUnit?: WeatherProviderResponse["windUnit"];
  rainProbability?: number; uvIndex?: number; condition?: string;
  timeOfDay?: WeatherProviderResponse["timeOfDay"]; hemisphere?: WeatherProviderResponse["hemisphere"]; monthIndex?: number;
  userGender?: string; userAge?: number; styleAesthetics?: string[]; colorPalette?: string;
  heatAdaptation?: string; stylingPreferences?: UserProfile["stylingPreferences"];
}

router.post("/suggest-outfits", (req, res) => {
  const body = req.body as SuggestBody;
  if (body.userAge !== undefined && (!Number.isInteger(body.userAge) || body.userAge < 12 || body.userAge > 50)) {
    res.status(400).json({ error: "userAge must be a whole number from 12 to 50", code: "INVALID_AGE" });
    return;
  }
  const result = getOutfitRecommendations({
    items: Array.isArray(body.items) ? body.items : [],
    weather: { temperature:body.temperature, weatherCode:body.weatherCode, humidity:body.humidity, windSpeed:body.windSpeed, windKmh:body.windKmh, windUnit:body.windUnit, rainProbability:body.rainProbability, uvIndex:body.uvIndex, condition:body.condition, timeOfDay:body.timeOfDay, hemisphere:body.hemisphere, monthIndex:body.monthIndex },
    user: { userGender:body.userGender, userAge:body.userAge, styleAesthetics:body.styleAesthetics, colorPalette:body.colorPalette, heatAdaptation:body.heatAdaptation, stylingPreferences:body.stylingPreferences },
  });
  if (!isCompleteRecommendation(result)) {
    const missingHijab = result.reasonCodes.includes("HIJAB_REQUIRED");
    const partial = result.bestPartial.map((item) => ({ itemId:item.id, role:roleFor(item.category) }));
    res.json({ outfits:!missingHijab && partial.length ? [{ name:"Best available look", mood:"casual", weatherNote:result.message, isComplete:false, items:partial, reasonCodes:result.reasonCodes }] : [], incomplete:true, missing:result.missing, message:missingHijab ? "Add or identify a hijab in your wardrobe to complete this look." : result.message, suggestedAddition:missingHijab ? "an owned hijab or headscarf" : result.suggestedAddition, reasonCodes:result.reasonCodes });
    return;
  }
  res.json({
    outfits: result.map((entry,index) => ({ name:index === 0 ? "Best for today" : `Weather-ready look ${index+1}`, mood:moodFor(entry.outfit.flatMap((item)=>item.tags)), weatherNote:entry.why.join(" · ") || "Matched to today’s conditions", isComplete:true, items:entry.outfit.map((item)=>({ itemId:item.id, role:roleFor(item.category) })), reasonCodes:entry.reasonCodes })),
    scores: result.map((entry)=>entry.score), reasons:result.map((entry)=>entry.why), reasonCodes:result.map((entry)=>entry.reasonCodes),
  });
});

export default router;
