import type { Language } from "@/contexts/LanguageContext";
import type { Gender } from "@/contexts/UserProfileContext";
import type { ClothingCategory } from "@/contexts/WardrobeContext";

export type ProfileCategoryOption = {
  key: ClothingCategory;
  label: string;
};

const CATEGORY_ORDER: ClothingCategory[] = [
  "tops",
  "bottoms",
  "dresses",
  "outerwear",
  "shoes",
  "socks",
  "accessories",
];

const LABELS: Record<Language, Record<"female" | "male", Record<ClothingCategory, string>>> = {
  en: {
    female: {
      tops: "Tops & Blouses",
      bottoms: "Skirts & Bottoms",
      dresses: "Dresses & Jumpsuits",
      outerwear: "Jackets & Coats",
      shoes: "Shoes & Heels",
      socks: "Socks & Hosiery",
      accessories: "Bags & Accessories",
    },
    male: {
      tops: "Tops & Shirts",
      bottoms: "Trousers & Shorts",
      dresses: "Dresses",
      outerwear: "Jackets & Coats",
      shoes: "Shoes",
      socks: "Socks",
      accessories: "Accessories",
    },
  },
  ru: {
    female: {
      tops: "Топы и блузки",
      bottoms: "Юбки и брюки",
      dresses: "Платья и комбинезоны",
      outerwear: "Куртки и пальто",
      shoes: "Обувь и каблуки",
      socks: "Носки и колготки",
      accessories: "Сумки и аксессуары",
    },
    male: {
      tops: "Футболки и рубашки",
      bottoms: "Брюки и шорты",
      dresses: "Платья",
      outerwear: "Куртки и пальто",
      shoes: "Обувь",
      socks: "Носки",
      accessories: "Аксессуары",
    },
  },
  uz: {
    female: {
      tops: "Toplar va bluzkalar",
      bottoms: "Yubkalar va shimlar",
      dresses: "Ko‘ylaklar va kombinezonlar",
      outerwear: "Kurtkalar va paltolar",
      shoes: "Poyabzal va poshnalar",
      socks: "Paypoq va kolgotkalar",
      accessories: "Sumkalar va aksessuarlar",
    },
    male: {
      tops: "Futbolkalar va ko‘ylaklar",
      bottoms: "Shimlar va shortilar",
      dresses: "Ko‘ylaklar",
      outerwear: "Kurtkalar va paltolar",
      shoes: "Poyabzal",
      socks: "Paypoqlar",
      accessories: "Aksessuarlar",
    },
  },
};

/**
 * Present wardrobe taxonomy for the saved profile. The storage categories stay
 * stable for recommendation compatibility, while the choices are explicit and
 * profile-appropriate. Male profiles do not get the one-piece dress category.
 */
export function getProfileCategoryOptions(
  gender: Gender | null,
  language: Language,
  translate: (key: string) => string,
): ProfileCategoryOption[] {
  if (gender !== "female" && gender !== "male") {
    return CATEGORY_ORDER.map((key) => ({ key, label: translate(`cat_${key}`) }));
  }

  const categories = gender === "male"
    ? CATEGORY_ORDER.filter((key) => key !== "dresses")
    : CATEGORY_ORDER;

  // Male profiles keep the gender-specific wording introduced alongside the
  // female taxonomy, while their visual icons remain the earlier icon set.
  if (gender === "male") {
    return categories.map((key) => ({ key, label: LABELS[language].male[key] }));
  }

  return categories.map((key) => ({ key, label: LABELS[language].female[key] }));
}
