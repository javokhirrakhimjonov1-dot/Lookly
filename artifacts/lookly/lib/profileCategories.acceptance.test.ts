import { getProfileCategoryOptions } from "./profileCategories";

const assert = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
};

const translated: Record<string, string> = {
  cat_tops: "Tops",
  cat_bottoms: "Bottoms",
  cat_dresses: "Dresses",
  cat_outerwear: "Outerwear",
  cat_shoes: "Shoes",
  cat_socks: "Socks",
  cat_accessories: "Accessories",
};
const translate = (key: string) => translated[key] ?? key;

const male = getProfileCategoryOptions("male", "en", translate);
assert(
  male.map(({ label }) => label).join("|") === "Tops & Shirts|Trousers & Shorts|Jackets & Coats|Shoes|Socks|Accessories",
  "male profiles must retain the later six gender-specific category names",
);
assert(!male.some(({ key }) => key === "dresses"), "male profiles must not show Dresses");

const female = getProfileCategoryOptions("female", "en", translate);
assert(
  female.find(({ key }) => key === "tops")?.label === "Tops & Blouses",
  "female profiles must retain the expanded garment-specific category names",
);
assert(female.some(({ key }) => key === "dresses"), "female profiles must retain Dresses");

console.log("Profile category acceptance checks passed");
