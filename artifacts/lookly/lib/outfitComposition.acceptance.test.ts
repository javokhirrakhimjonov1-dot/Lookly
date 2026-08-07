import { enforceExclusiveBase, packingSeparateTargets } from "./outfitComposition";
import type { ClothingItem } from "@/contexts/WardrobeContext";
const assert=(condition:unknown,message:string)=>{if(!condition)throw new Error(message);};
const item=(id:string,category:ClothingItem["category"]):ClothingItem=>({id,name:id,category,color:"Black",colorHex:"#000000",seasons:[],fabricWeight:"medium",isWorkwear:false,timesWorn:0,tags:[],createdAt:"2026-01-01"});
const mixed={tops:item("top","tops"),bottoms:item("skirt","bottoms"),dresses:item("dress","dresses")};
const onePiece=enforceExclusiveBase(mixed,new Set()); assert(Boolean(onePiece.dresses)&&!onePiece.tops&&!onePiece.bottoms,"generated one-piece must replace separates");
const separates=enforceExclusiveBase(mixed,new Set(["tops"])); assert(Boolean(separates.tops)&&Boolean(separates.bottoms)&&!separates.dresses,"locked separates must replace generated dress");
const targets=packingSeparateTargets(6,3,2); assert(targets.dressesUsed===2&&targets.topsNeeded===4&&targets.bottomsNeeded===1,"dresses must replace tops and bottoms");
console.log("Outfit composition acceptance checks passed");
