export type TaalId = "none" | "keherwa" | "teentaal";

export type TablaBol =
  | "Dha"
  | "Dhin"
  | "Tin"
  | "Ta"
  | "Na"
  | "Ge"
  | "Ti"
  | "Ka";

export type VibhagMarker = "sam" | "tali" | "khali" | "regular";

export interface TaalMatra {
  matra: number; // 1-based beat index
  bol: TablaBol;
  marker: VibhagMarker;
}

export interface TaalDefinition {
  id: Exclude<TaalId, "none">;
  name: string;
  totalMatras: number;
  vibhagDivision: string;
  theka: TaalMatra[];
}

export const TAAL_DEFINITIONS: Record<
  Exclude<TaalId, "none">,
  TaalDefinition
> = {
  keherwa: {
    id: "keherwa",
    name: "Keherwa Taal (8 Matras)",
    totalMatras: 8,
    vibhagDivision: "4 + 4",
    theka: [
      { matra: 1, bol: "Dha", marker: "sam" },
      { matra: 2, bol: "Ge", marker: "regular" },
      { matra: 3, bol: "Na", marker: "regular" },
      { matra: 4, bol: "Ti", marker: "regular" },
      { matra: 5, bol: "Na", marker: "khali" },
      { matra: 6, bol: "Ka", marker: "regular" },
      { matra: 7, bol: "Dhin", marker: "regular" },
      { matra: 8, bol: "Na", marker: "regular" },
    ],
  },
  teentaal: {
    id: "teentaal",
    name: "Teen Taal (16 Matras)",
    totalMatras: 16,
    vibhagDivision: "4 + 4 + 4 + 4",
    theka: [
      // Vibhag 1 (Sam - X)
      { matra: 1, bol: "Dha", marker: "sam" },
      { matra: 2, bol: "Dhin", marker: "regular" },
      { matra: 3, bol: "Dhin", marker: "regular" },
      { matra: 4, bol: "Dha", marker: "regular" },
      // Vibhag 2 (Tali 2)
      { matra: 5, bol: "Dha", marker: "tali" },
      { matra: 6, bol: "Dhin", marker: "regular" },
      { matra: 7, bol: "Dhin", marker: "regular" },
      { matra: 8, bol: "Dha", marker: "regular" },
      // Vibhag 3 (Khali - 0)
      { matra: 9, bol: "Dha", marker: "khali" },
      { matra: 10, bol: "Tin", marker: "regular" },
      { matra: 11, bol: "Tin", marker: "regular" },
      { matra: 12, bol: "Ta", marker: "regular" },
      // Vibhag 4 (Tali 3)
      { matra: 13, bol: "Ta", marker: "tali" },
      { matra: 14, bol: "Dhin", marker: "regular" },
      { matra: 15, bol: "Dhin", marker: "regular" },
      { matra: 16, bol: "Dha", marker: "regular" },
    ],
  },
};

export function getTaalMatra(
  taalId: Exclude<TaalId, "none">,
  beatIndex: number,
): TaalMatra {
  const def = TAAL_DEFINITIONS[taalId];
  const normalizedIndex =
    ((beatIndex % def.totalMatras) + def.totalMatras) % def.totalMatras;
  return def.theka[normalizedIndex];
}
