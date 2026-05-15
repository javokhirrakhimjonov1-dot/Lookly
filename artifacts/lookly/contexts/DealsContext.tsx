import React, { createContext, useContext, useState } from "react";

export interface Deal {
  id: string;
  brandName: string;
  discount: number;
  description: string;
  expiresAt: string;
  location: string;
  category: string;
  accentColor: string;
  isNew: boolean;
}

const DEALS: Deal[] = [
  {
    id: "d1",
    brandName: "Zara",
    discount: 30,
    description: "End-of-season sale on women's collection",
    expiresAt: new Date(Date.now() + 5 * 24 * 3600000).toISOString(),
    location: "Yunusabad Mall",
    category: "Women",
    accentColor: "#1C1512",
    isNew: true,
  },
  {
    id: "d2",
    brandName: "Mango",
    discount: 25,
    description: "Summer essentials – dresses & tops",
    expiresAt: new Date(Date.now() + 3 * 24 * 3600000).toISOString(),
    location: "Compass Shopping",
    category: "Women",
    accentColor: "#8B4513",
    isNew: true,
  },
  {
    id: "d3",
    brandName: "H&M",
    discount: 40,
    description: "Buy 2 get 1 free on basics",
    expiresAt: new Date(Date.now() + 7 * 24 * 3600000).toISOString(),
    location: "Next Silk Road",
    category: "All",
    accentColor: "#CC0000",
    isNew: false,
  },
  {
    id: "d4",
    brandName: "Pull&Bear",
    discount: 20,
    description: "New arrivals with membership discount",
    expiresAt: new Date(Date.now() + 4 * 24 * 3600000).toISOString(),
    location: "Mega Planet",
    category: "Men",
    accentColor: "#2D5BE3",
    isNew: false,
  },
  {
    id: "d5",
    brandName: "Reserved",
    discount: 35,
    description: "Autumn-winter pre-sale collection",
    expiresAt: new Date(Date.now() + 2 * 24 * 3600000).toISOString(),
    location: "Mega Planet",
    category: "All",
    accentColor: "#4A4A4A",
    isNew: true,
  },
  {
    id: "d6",
    brandName: "Massimo Dutti",
    discount: 15,
    description: "Premium menswear – shirts & suits",
    expiresAt: new Date(Date.now() + 10 * 24 * 3600000).toISOString(),
    location: "Compass Shopping",
    category: "Men",
    accentColor: "#B8860B",
    isNew: false,
  },
  {
    id: "d7",
    brandName: "Gloria Jeans",
    discount: 45,
    description: "Kids & teen flash sale this weekend",
    expiresAt: new Date(Date.now() + 2 * 24 * 3600000).toISOString(),
    location: "NEXT Mall",
    category: "Kids",
    accentColor: "#E05B2B",
    isNew: true,
  },
  {
    id: "d8",
    brandName: "Bershka",
    discount: 30,
    description: "Street style collection clearance",
    expiresAt: new Date(Date.now() + 6 * 24 * 3600000).toISOString(),
    location: "Mega Planet",
    category: "Women",
    accentColor: "#6B21A8",
    isNew: false,
  },
];

interface DealsContextValue {
  deals: Deal[];
  activeCategory: string;
  setActiveCategory: (c: string) => void;
  filteredDeals: Deal[];
}

const DealsContext = createContext<DealsContextValue | null>(null);

export function DealsProvider({ children }: { children: React.ReactNode }) {
  const [activeCategory, setActiveCategory] = useState("All");

  const filteredDeals =
    activeCategory === "All"
      ? DEALS
      : DEALS.filter((d) => d.category === activeCategory);

  return (
    <DealsContext.Provider
      value={{ deals: DEALS, activeCategory, setActiveCategory, filteredDeals }}
    >
      {children}
    </DealsContext.Provider>
  );
}

export function useDeals() {
  const ctx = useContext(DealsContext);
  if (!ctx) throw new Error("useDeals must be inside DealsProvider");
  return ctx;
}
