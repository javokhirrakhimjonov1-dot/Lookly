import { isUnsupportedSpecialistItem, normalizeCategory } from "../data/recognitionTaxonomy";
const assert=(condition:unknown,message:string)=>{if(!condition)throw new Error(message);};
const cases:[string,string][]=[
  ["silk blouse","tops"],["ribbed bodysuit","tops"],["linen tunic","tops"],["sleeveless camisole","tops"],
  ["a-line midi skirt","bottoms"],["wide-leg trousers","bottoms"],["denim culottes","bottoms"],["high-rise leggings","bottoms"],
  ["wrap dress","dresses"],["tailored jumpsuit","dresses"],["summer romper","dresses"],["maxi shirt dress","dresses"],
  ["wool coat","outerwear"],["cropped cardigan jacket","outerwear"],["light trench","outerwear"],
  ["block heels","shoes"],["knee-high boots","shoes"],["ballet flats","shoes"],["leather loafers","shoes"],["strappy sandals","shoes"],
  ["opaque tights","socks"],["sheer hosiery","socks"],["thermal stockings","socks"],
  ["structured handbag","accessories"],["gold necklace","accessories"],["silk hijab","accessories"],["printed headscarf","accessories"],["leather belt","accessories"],["sun hat","accessories"],["silver earrings","accessories"],
];
for(const [name,expected] of cases){const raw=expected==="outerwear"?"outerwear":"unknown";assert(normalizeCategory(raw,name,[])===expected,`${name} must map to ${expected}`);}
for(const unsupported of ["lace bra","maternity dress","one-piece swimsuit","silk lingerie"]){assert(isUnsupportedSpecialistItem(unsupported,[],unsupported),`${unsupported} must be excluded from everyday v1`);}
console.log("Recognition taxonomy acceptance checks passed (30 everyday garment cases)");
