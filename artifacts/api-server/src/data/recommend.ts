import { recommend } from "../engine/weatherEngine";
import type { ScoredOutfit, UserProfile } from "../engine/weatherEngine";
import { mapWardrobe, type StoredWardrobeItem } from "./wardrobeMap";
import { mapWeather, type WeatherProviderResponse } from "../weather/mapWeather";
export interface RecommendationRequest { items:StoredWardrobeItem[]; weather:WeatherProviderResponse; user?:Partial<UserProfile>&{userGender?:string;userAge?:number;styleAesthetics?:string[];colorPalette?:string;heatAdaptation?:string;stylingPreferences?:UserProfile["stylingPreferences"]}; topN?:number; }
export function mapUserProfile(input:RecommendationRequest["user"]):UserProfile { const prefs=input?.stylePreferences??input?.styleAesthetics??[]; const stylePreferences=prefs.map((x)=>x.replace(/_/g," ").trim()).filter(Boolean); return { age:input?.age??input?.userAge, gender:input?.gender??input?.userGender, stylePreferences:stylePreferences.length?stylePreferences:["casual"], colorPreferences:input?.colorPreferences??(input?.colorPalette?[input.colorPalette.replace(/_/g," ")]:undefined), lifestyle:input?.lifestyle, climateZone:input?.climateZone, heatAdaptation:input?.heatAdaptation, stylingPreferences:input?.stylingPreferences }; }
export const getOutfitRecommendations=(input:RecommendationRequest)=>recommend(mapWardrobe(Array.isArray(input.items)?input.items:[]),mapWeather(input.weather),mapUserProfile(input.user),input.topN??5);
export const isCompleteRecommendation=(value:ReturnType<typeof getOutfitRecommendations>):value is ScoredOutfit[]=>Array.isArray(value);
