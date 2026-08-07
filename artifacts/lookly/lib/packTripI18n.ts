import type { Language } from "@/contexts/LanguageContext";

const en = {
  packingUtility: "PACKING UTILITY",
  whereGoing: "Where are you going?",
  intro: "Pick your destination and travel dates — we'll match your wardrobe to the real forecast.",
  destination: "DESTINATION",
  destinationPlaceholder: "e.g. Dubai, Istanbul, Paris…",
  travelDates: "TRAVEL DATES",
  departure: "DEPARTURE",
  returnDate: "RETURN",
  selectDate: "Select date",
  tapReturn: "Now tap your return date",
  nightsChange: "{count} {nights} · tap a date to change",
  done: "Done",
  night: "night",
  nightFew: "nights",
  nights: "nights",
  day: "day",
  dayFew: "days",
  days: "days",
  enterCity: "Enter a destination city",
  selectDates: "Select your travel dates",
  invalidDates: "Return date must be after departure",
  cityNotFound: "Could not find “{city}”. Try a different spelling.",
  weatherError: "Could not fetch weather. Check your connection.",
  forecastLimitNotice: "Weather services normally provide live forecasts only up to 16 days ahead. This plan uses seasonal climate averages — check again closer to your trip for a live forecast.",
  seasonalEstimate: "seasonal estimate",
  checkingForecast: "Checking forecast…",
  packForNights: "Pack for {count} {nights}",
  generateList: "Generate packing list",
  average: "avg",
  forecast: "forecast",
  fromWardrobe: "FROM YOUR WARDROBE",
  considerBuying: "consider buying",
  considerPacking: "CONSIDER PACKING",
  stillNeeded: "STILL NEEDED · {count}",
  stillNeededStat: "still needed",
  stillNeededHint: "No verified store match is safe for this forecast. Use this checklist instead.",
  viewProduct: "View {name} at {store}",
  tierFreezing: "Freezing",
  tierCold: "Cold",
  tierCool: "Cool",
  tierMild: "Mild",
  tierWarm: "Warm",
  tierHot: "Hot",
  tierFreezingDesc: "Below 0°C — heavy winter gear",
  tierColdDesc: "0–10°C — warm outerwear needed",
  tierCoolDesc: "10–17°C — light jacket days",
  tierMildDesc: "17–24°C — comfortable layering",
  tierWarmDesc: "24–30°C — light fabrics",
  tierHotDesc: "Above 30°C — summer essentials only",
  fromWardrobeStat: "from wardrobe",
  topsReason: "{needed} tops for {days} {dayWord} at {temp}°C avg",
  bottomsReason: "{needed} bottoms for the trip",
  heavyCoatReason: "Heavy coat required — lows below 10°C",
  lightJacketReason: "Light jacket for cool evenings",
  shoesReasonHot: "{needed} pairs — sandals / sneakers for heat",
  shoesReasonCool: "{needed} pairs — closed-toe for cooler temperatures",
  rainReason: "Precipitation forecast — pack a rain layer",
  rainAccessoriesReason: "Only rain-ready accessories are included for this forecast",
  sunAccessoriesReason: "Only sun-protection accessories are included for warm weather",
  tempAccessoriesReason: "Only accessories that help with this temperature are included",
  rainGear: "Rain Gear",
  weatherAccessories: "Weather accessories",
  shopRainOpenToe: "Best saved for dry parts of the trip; open toes are not ideal on wet streets.",
  shopRainClosedShoe: "Closed-toe coverage is a safer choice for wet streets.",
  shopRainOuterwear: "An extra layer helps when rain and cooler air arrive.",
  shopRainBottoms: "Full-length coverage is more practical for wet, changeable days.",
  shopRainCotton: "A breathable base layer that can be paired with a light rain shell.",
  shopRainShortSleeve: "A light option for dry breaks between showers; add a shell if needed.",
  shopRainGeneric: "A flexible top for layering when conditions change.",
  shopWarmLight: "Its light feel helps air circulate in warm weather.",
  shopWarmEssential: "A simple breathable base for sunny, warm days.",
  shopWarmPremium: "A relaxed warm-weather option with room for airflow.",
  shopWarmTop: "Short sleeves help keep this option comfortable in the heat.",
  shopWarmOpenToe: "Open-toe airflow makes this a better pick for dry, warm days.",
  shopWarmShoe: "A walking-friendly option for warm days and cooler evenings.",
  shopWarmJeans: "Denim works best for cooler evenings after a warm day.",
  shopWarmBottoms: "A lighter full-length option for warm days and cooler evenings.",
  shopWarmGeneric: "A practical finishing piece for warm-weather outfits.",
  shopColdOuterwear: "An extra layer helps retain warmth in cold air.",
  shopColdBottoms: "Full-length coverage gives more comfort when temperatures drop.",
  shopColdShoes: "Closed-toe coverage is more comfortable in cold conditions.",
  shopColdGeneric: "A useful piece for building a warmer outfit.",
  shopCoolOuterwear: "Easy to layer on cool mornings and take off later.",
  shopCoolBottoms: "Full-length coverage works well through a cool day.",
  flexibleWeather: "A versatile choice for mild, layered weather.",
  comfortableWeather: "A flexible choice for comfortable daytime-to-evening weather.",
  wardrobeRainOpenToe: "Best kept for dry periods; open toes are not ideal on wet streets.",
  wardrobeRainClosedShoe: "Closed-toe coverage is safer for wet streets.",
  wardrobeRainResistant: "Its weather-resistant finish suits the rain forecast.",
  wardrobeRainOuterwear: "A useful outer layer when showers and cooler air arrive.",
  wardrobeRainBottoms: "Full-length coverage is more practical for a wet, changeable day.",
  wardrobeRainBase: "A breathable base layer that works under a light rain shell.",
  wardrobeRainGeneric: "A flexible layer to pair with a rain-ready outer layer when needed.",
  wardrobeWarmLight: "Its lighter construction is more comfortable in warm weather.",
  wardrobeWarmOpenToe: "Open-toe airflow helps keep feet cooler on dry, warm days.",
  wardrobeWarmShoe: "A walking-friendly option for warm days and cooler evenings.",
  wardrobeWarmBottoms: "A practical lower layer for a warm day that may cool off later.",
  wardrobeWarmGeneric: "Chosen to keep the outfit comfortable as temperatures stay warm.",
  wardrobeColdHeavy: "Its heavier fabric helps retain warmth in colder air.",
  wardrobeColdShoes: "Closed-toe coverage is more comfortable when temperatures drop.",
  wardrobeColdGeneric: "A useful layer for keeping warm through the trip.",
  wardrobeCoolShoes: "Closed-toe footwear is more comfortable through cool mornings and evenings.",
  wardrobeCoolBottoms: "Full-length coverage is comfortable as the day stays cool.",
  wardrobeCoolOuterwear: "Easy to add for a cool morning and take off later.",
  wardrobeCoolGeneric: "Easy to layer for cool mornings and milder afternoons.",
} as const;

type PackTripKey = keyof typeof en;

const ru: Record<PackTripKey, string> = {
  packingUtility: "ПОМОЩНИК ПО СБОРАМ", whereGoing: "Куда вы едете?", intro: "Выберите направление и даты поездки — мы подберём вещи из вашего гардероба по реальному прогнозу.", destination: "НАПРАВЛЕНИЕ", destinationPlaceholder: "например, Дубай, Стамбул, Париж…", travelDates: "ДАТЫ ПОЕЗДКИ", departure: "ОТПРАВЛЕНИЕ", returnDate: "ВОЗВРАЩЕНИЕ", selectDate: "Выберите дату", tapReturn: "Теперь выберите дату возвращения", nightsChange: "{count} {nights} · нажмите дату, чтобы изменить", done: "Готово", night: "ночь", nightFew: "ночи", nights: "ночей", day: "день", dayFew: "дня", days: "дней", enterCity: "Введите город назначения", selectDates: "Выберите даты поездки", invalidDates: "Дата возвращения должна быть позже даты отправления", cityNotFound: "Не удалось найти «{city}». Проверьте написание.", weatherError: "Не удалось загрузить погоду. Проверьте подключение.", forecastLimitNotice: "Сервисы погоды обычно предоставляют актуальный прогноз только на 16 дней вперёд. Поэтому план основан на сезонных климатических данных — вернитесь ближе к поездке за актуальным прогнозом.", seasonalEstimate: "сезонная оценка", checkingForecast: "Проверяем прогноз…", packForNights: "Собрать вещи на {count} {nights}", generateList: "Создать список вещей", average: "в среднем", forecast: "прогноз", fromWardrobe: "ИЗ ВАШЕГО ГАРДЕРОБА", considerBuying: "стоит купить", considerPacking: "СТОИТ ВЗЯТЬ", viewProduct: "Открыть {name} в {store}", tierFreezing: "Мороз", tierCold: "Холодно", tierCool: "Прохладно", tierMild: "Умеренно", tierWarm: "Тепло", tierHot: "Жарко", tierFreezingDesc: "Ниже 0°C — нужна тяжёлая зимняя одежда", tierColdDesc: "0–10°C — нужна тёплая верхняя одежда", tierCoolDesc: "10–17°C — погода для лёгкой куртки", tierMildDesc: "17–24°C — удобно одеваться слоями", tierWarmDesc: "24–30°C — лёгкие ткани", tierHotDesc: "Выше 30°C — только летние вещи", fromWardrobeStat: "из гардероба", topsReason: "{needed} верхов на {days} {dayWord}, в среднем {temp}°C", bottomsReason: "{needed} вариантов низа на поездку", heavyCoatReason: "Нужно тёплое пальто — ночью ниже 10°C", lightJacketReason: "Лёгкая куртка для прохладных вечеров", shoesReasonHot: "{needed} пары — сандалии или кеды для жары", shoesReasonCool: "{needed} пары — закрытая обувь для прохладной погоды", rainReason: "Ожидаются осадки — возьмите защиту от дождя", rainAccessoriesReason: "Показаны только аксессуары, подходящие для дождя", sunAccessoriesReason: "Показаны только аксессуары для защиты от солнца", tempAccessoriesReason: "Показаны только аксессуары, подходящие для этой температуры", rainGear: "Защита от дождя", weatherAccessories: "Аксессуары по погоде", shopRainOpenToe: "Лучше оставить для сухих дней: открытая обувь неудобна на мокрых улицах.", shopRainClosedShoe: "Закрытая обувь безопаснее для мокрых улиц.", shopRainOuterwear: "Дополнительный слой пригодится при дожде и прохладе.", shopRainBottoms: "Полная длина практичнее в сырую и переменчивую погоду.", shopRainCotton: "Дышащий базовый слой, который можно надеть под лёгкую дождевую куртку.", shopRainShortSleeve: "Лёгкий вариант для сухих перерывов между дождями; при необходимости добавьте куртку.", shopRainGeneric: "Универсальный верх для многослойного образа при переменчивой погоде.", shopWarmLight: "Лёгкий материал помогает воздуху циркулировать в тёплую погоду.", shopWarmEssential: "Простой дышащий базовый слой для солнечных тёплых дней.", shopWarmPremium: "Свободный вариант для тёплой погоды с хорошей циркуляцией воздуха.", shopWarmTop: "Короткие рукава помогают сохранять комфорт в жару.", shopWarmOpenToe: "Открытая обувь хорошо проветривается в сухую тёплую погоду.", shopWarmShoe: "Удобный вариант для прогулок в тёплые дни и прохладные вечера.", shopWarmJeans: "Джинсы лучше подойдут для прохладного вечера после тёплого дня.", shopWarmBottoms: "Лёгкий вариант полной длины для тёплых дней и прохладных вечеров.", shopWarmGeneric: "Практичное дополнение к образам для тёплой погоды.", shopColdOuterwear: "Дополнительный слой помогает сохранять тепло в холодном воздухе.", shopColdBottoms: "Полная длина обеспечивает больше комфорта при понижении температуры.", shopColdShoes: "Закрытая обувь комфортнее в холодную погоду.", shopColdGeneric: "Полезная вещь для создания более тёплого образа.", shopCoolOuterwear: "Легко надеть прохладным утром и снять позже.", shopCoolBottoms: "Полная длина хорошо подходит для прохладного дня.", flexibleWeather: "Универсальный выбор для умеренной погоды и многослойных образов.", comfortableWeather: "Универсальный выбор для комфортной погоды с утра до вечера.", wardrobeRainOpenToe: "Лучше оставить для сухих периодов: открытая обувь неудобна на мокрых улицах.", wardrobeRainClosedShoe: "Закрытая обувь безопаснее для мокрых улиц.", wardrobeRainResistant: "Влагостойкое покрытие подходит для дождливого прогноза.", wardrobeRainOuterwear: "Полезный верхний слой на случай дождя и прохлады.", wardrobeRainBottoms: "Полная длина практичнее в сырую переменчивую погоду.", wardrobeRainBase: "Дышащий базовый слой, который хорошо работает под лёгкой дождевой курткой.", wardrobeRainGeneric: "Универсальный слой, который при необходимости можно сочетать с защитой от дождя.", wardrobeWarmLight: "Лёгкая конструкция комфортнее в тёплую погоду.", wardrobeWarmOpenToe: "Открытая обувь помогает ногам не перегреваться в сухие тёплые дни.", wardrobeWarmShoe: "Удобный вариант для прогулок в тёплые дни и прохладные вечера.", wardrobeWarmBottoms: "Практичный нижний слой для тёплого дня, который может стать прохладнее.", wardrobeWarmGeneric: "Выбрано для комфорта при устойчиво тёплой погоде.", wardrobeColdHeavy: "Плотная ткань помогает сохранять тепло в холодном воздухе.", wardrobeColdShoes: "Закрытая обувь комфортнее при понижении температуры.", wardrobeColdGeneric: "Полезный слой, чтобы не замёрзнуть в поездке.", wardrobeCoolShoes: "Закрытая обувь комфортнее прохладным утром и вечером.", wardrobeCoolBottoms: "Полная длина комфортна в течение прохладного дня.", wardrobeCoolOuterwear: "Легко надеть прохладным утром и снять позже.", wardrobeCoolGeneric: "Легко сочетать слоями для прохладного утра и более мягкого дня.",
  stillNeeded: "ЕЩЁ НУЖНО · {count}",
  stillNeededStat: "ещё нужно",
  stillNeededHint: "Для этого прогноза нет проверенного безопасного товара. Используйте этот список.",
};

const uz: Record<PackTripKey, string> = {
  packingUtility: "SAFAR UCHUN YORDAMCHI", whereGoing: "Qayerga ketyapsiz?", intro: "Manzil va safar sanalarini tanlang — garderobingizni haqiqiy ob-havo prognoziga moslaymiz.", destination: "MANZIL", destinationPlaceholder: "masalan, Dubay, Istanbul, Parij…", travelDates: "SAFAR SANALARI", departure: "JO‘NASH", returnDate: "QAYTISH", selectDate: "Sanani tanlang", tapReturn: "Endi qaytish sanasini tanlang", nightsChange: "{count} {nights} · o‘zgartirish uchun sanani bosing", done: "Tayyor", night: "kecha", nightFew: "kecha", nights: "kecha", day: "kun", dayFew: "kun", days: "kun", enterCity: "Manzil shahrini kiriting", selectDates: "Safar sanalarini tanlang", invalidDates: "Qaytish sanasi jo‘nash sanasidan keyin bo‘lishi kerak", cityNotFound: "“{city}” topilmadi. Boshqa imloni sinab ko‘ring.", weatherError: "Ob-havoni yuklab bo‘lmadi. Internet aloqasini tekshiring.", checkingForecast: "Prognoz tekshirilmoqda…", packForNights: "{count} {nights} uchun yuk tayyorlash", generateList: "Yuk ro‘yxatini yaratish", average: "o‘rtacha", forecast: "prognoz", fromWardrobe: "GARDEROBINGIZDAN", considerBuying: "sotib olish mumkin", considerPacking: "OLIB KETISHNI O‘YLAB KO‘RING", viewProduct: "{name} mahsulotini {store} saytida ko‘rish", tierFreezing: "Ayoz", tierCold: "Sovuq", tierCool: "Salqin", tierMild: "Mo‘tadil", tierWarm: "Iliq", tierHot: "Issiq", tierFreezingDesc: "0°C dan past — qalin qishki kiyimlar kerak", tierColdDesc: "0–10°C — issiq ustki kiyim kerak", tierCoolDesc: "10–17°C — yengil kurtka uchun mos", tierMildDesc: "17–24°C — qatlamlab kiyinish qulay", tierWarmDesc: "24–30°C — yengil matolar", tierHotDesc: "30°C dan yuqori — faqat yozgi kiyimlar", fromWardrobeStat: "garderobdan", topsReason: "{days} {dayWord} uchun {needed} ta ustki kiyim, o‘rtacha {temp}°C", bottomsReason: "Safar uchun {needed} ta pastki kiyim", heavyCoatReason: "Qalin palto kerak — eng past harorat 10°C dan past", lightJacketReason: "Salqin oqshomlar uchun yengil kurtka", shoesReasonHot: "{needed} juft — issiq uchun sandal yoki krossovka", shoesReasonCool: "{needed} juft — salqin harorat uchun yopiq oyoq kiyim", rainReason: "Yog‘ingarchilik kutilmoqda — yomg‘irga mos ustki kiyim oling", rainAccessoriesReason: "Bu prognoz uchun faqat yomg‘irga mos aksessuarlar kiritilgan", sunAccessoriesReason: "Iliq ob-havo uchun faqat quyoshdan himoya aksessuarlari kiritilgan", tempAccessoriesReason: "Faqat ushbu haroratga mos aksessuarlar kiritilgan", rainGear: "Yomg‘ir kiyimlari", weatherAccessories: "Ob-havoga mos aksessuarlar", shopRainOpenToe: "Safarning quruq kunlari uchun saqlagan ma’qul; ochiq oyoq kiyim ho‘l ko‘chalarga mos emas.", shopRainClosedShoe: "Yopiq oyoq kiyim ho‘l ko‘chalarda xavfsizroq.", shopRainOuterwear: "Yomg‘ir va salqin havo kelganda qo‘shimcha qatlam yordam beradi.", shopRainBottoms: "Uzun kiyim nam va o‘zgaruvchan kunlar uchun amaliyroq.", shopRainCotton: "Yengil yomg‘irpo‘sh bilan kiyish mumkin bo‘lgan havo o‘tkazuvchi asosiy qatlam.", shopRainShortSleeve: "Yomg‘ir oralig‘idagi quruq paytlar uchun yengil variant; kerak bo‘lsa, ustki qatlam qo‘shing.", shopRainGeneric: "Sharoit o‘zgarganda qatlamlab kiyish uchun moslashuvchan ustki kiyim.", shopWarmLight: "Yengil mato iliq havoda havo aylanishiga yordam beradi.", shopWarmEssential: "Quyoshli iliq kunlar uchun oddiy va havo o‘tkazuvchi asosiy qatlam.", shopWarmPremium: "Havo aylanishi uchun yetarli joyga ega, iliq ob-havoga mos erkin variant.", shopWarmTop: "Kalta yenglar issiqda qulaylikni saqlashga yordam beradi.", shopWarmOpenToe: "Ochiq oyoq kiyim quruq va iliq kunlarda yaxshi shamollaydi.", shopWarmShoe: "Iliq kunlar va salqin oqshomlarda yurish uchun qulay variant.", shopWarmJeans: "Jinsi iliq kundan keyingi salqin oqshomlar uchun yaxshiroq.", shopWarmBottoms: "Iliq kunlar va salqin oqshomlar uchun yengil, uzun variant.", shopWarmGeneric: "Iliq ob-havo obrazlari uchun amaliy yakuniy detal.", shopColdOuterwear: "Qo‘shimcha qatlam sovuq havoda issiqlikni saqlashga yordam beradi.", shopColdBottoms: "Uzun kiyim harorat pasayganda ko‘proq qulaylik beradi.", shopColdShoes: "Yopiq oyoq kiyim sovuq sharoitda qulayroq.", shopColdGeneric: "Issiqroq obraz yaratish uchun foydali kiyim.", shopCoolOuterwear: "Salqin tongda kiyib, keyin yechish oson.", shopCoolBottoms: "Uzun kiyim salqin kun davomida yaxshi mos keladi.", flexibleWeather: "Mo‘tadil va qatlamli ob-havo uchun universal tanlov.", comfortableWeather: "Kunduzdan oqshomgacha qulay ob-havo uchun universal tanlov.", wardrobeRainOpenToe: "Quruq paytlar uchun saqlagan ma’qul; ochiq oyoq kiyim ho‘l ko‘chalarga mos emas.", wardrobeRainClosedShoe: "Yopiq oyoq kiyim ho‘l ko‘chalarda xavfsizroq.", wardrobeRainResistant: "Ob-havoga chidamli qoplamasi yomg‘irli prognozga mos.", wardrobeRainOuterwear: "Yomg‘ir va salqin havo uchun foydali ustki qatlam.", wardrobeRainBottoms: "Uzun kiyim nam va o‘zgaruvchan kun uchun amaliyroq.", wardrobeRainBase: "Yengil yomg‘irpo‘sh ostida kiyishga mos havo o‘tkazuvchi asosiy qatlam.", wardrobeRainGeneric: "Kerak bo‘lganda yomg‘irga mos ustki qatlam bilan kiyish mumkin.", wardrobeWarmLight: "Yengil tuzilishi iliq havoda qulayroq.", wardrobeWarmOpenToe: "Ochiq oyoq kiyim quruq va iliq kunlarda oyoqni salqinroq tutadi.", wardrobeWarmShoe: "Iliq kunlar va salqin oqshomlarda yurish uchun qulay variant.", wardrobeWarmBottoms: "Keyinroq salqinlashishi mumkin bo‘lgan iliq kun uchun amaliy pastki qatlam.", wardrobeWarmGeneric: "Harorat iliq bo‘lganda qulaylikni saqlash uchun tanlandi.", wardrobeColdHeavy: "Qalin matosi sovuq havoda issiqlikni saqlashga yordam beradi.", wardrobeColdShoes: "Yopiq oyoq kiyim harorat pasayganda qulayroq.", wardrobeColdGeneric: "Safar davomida issiq turish uchun foydali qatlam.", wardrobeCoolShoes: "Yopiq oyoq kiyim salqin tong va oqshomlarda qulayroq.", wardrobeCoolBottoms: "Uzun kiyim salqin kun davomida qulay.", wardrobeCoolOuterwear: "Salqin tongda qo‘shib, keyin yechish oson.", wardrobeCoolGeneric: "Salqin tong va yumshoq tushdan keyin qatlamlab kiyish oson.",
  forecastLimitNotice: "Ob-havo xizmatlari odatda jonli prognozni faqat 16 kun oldingacha taqdim etadi. Shu sababli bu reja mavsumiy iqlim ma’lumotlariga asoslangan — jonli prognoz uchun safarga yaqinroq yana tekshiring.",
  seasonalEstimate: "mavsumiy taxmin",
  stillNeeded: "HALI KERAK · {count}",
  stillNeededStat: "hali kerak",
  stillNeededHint: "Bu prognoz uchun xavfsizligi tasdiqlangan do‘kon mahsuloti yo‘q. Ushbu ro‘yxatdan foydalaning.",
};

const copy: Record<Language, Record<PackTripKey, string>> = { en, ru, uz };

export function packTripText(
  lang: Language,
  key: PackTripKey,
  values: Record<string, string | number> = {},
): string {
  return Object.entries(values).reduce(
    (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
    copy[lang][key],
  );
}

export function packTripLocale(lang: Language): string {
  return lang === "ru" ? "ru-RU" : lang === "uz" ? "uz-UZ" : "en-US";
}

export function packTripCountWord(lang: Language, count: number, unit: "night" | "day"): string {
  if (lang !== "ru") return packTripText(lang, count === 1 ? unit : `${unit}s` as "nights" | "days");
  const mod100 = count % 100;
  const mod10 = count % 10;
  const form = mod10 === 1 && mod100 !== 11
    ? unit
    : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
      ? `${unit}Few` as "nightFew" | "dayFew"
      : `${unit}s` as "nights" | "days";
  return packTripText(lang, form);
}

const productNames: Record<Exclude<Language, "en">, Record<string, string>> = {
  ru: {
    "just-tee": "Базовая хлопковая футболка",
    "just-overshirt": "Лёгкая верхняя рубашка",
    "just-trousers": "Классические брюки",
    "just-jeans": "Прямые джинсы",
    "just-chinos": "Лёгкие чиносы",
    "just-shoes": "Повседневные открытые сандалии",
    "just-belt": "Кожаный ремень",
    "terra-tee-black": "Хлопковая футболка TerraPro",
    "terra-tee-light": "Футболка TerraPro с коротким рукавом",
    "terra-tee-classic": "Премиальная футболка TerraPro",
  },
  uz: {
    "just-tee": "Asosiy paxtali futbolka",
    "just-overshirt": "Yengil ustki ko‘ylak",
    "just-trousers": "Klassik shim",
    "just-jeans": "To‘g‘ri bichimli jinsi",
    "just-chinos": "Yengil chino shim",
    "just-shoes": "Kundalik ochiq sandal",
    "just-belt": "Charm kamar",
    "terra-tee-black": "TerraPro paxtali futbolkasi",
    "terra-tee-light": "TerraPro kalta yengli futbolkasi",
    "terra-tee-classic": "TerraPro premium futbolkasi",
  },
};

export function packTripProductName(lang: Language, id: string, fallback: string): string {
  return lang === "en" ? fallback : productNames[lang][id] ?? fallback;
}
