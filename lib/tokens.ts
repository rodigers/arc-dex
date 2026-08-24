export const TOKENS = [
  {
    symbol: "USDC",
    name: "USD Coin",
    color: "#2775CA",
    glyph: "$",
  },
  {
    symbol: "EURC",
    name: "Euro Coin",
    color: "#0EA5E9",
    glyph: "€",
  },
  {
    symbol: "NATIVE",
    name: "USDC (gas)",
    color: "#111827",
    glyph: "⛽",
  },
] as const;

export type TokenSymbol = (typeof TOKENS)[number]["symbol"];

export function tokenMeta(symbol: string) {
  return TOKENS.find((t) => t.symbol === symbol) ?? TOKENS[0];
}

export const ARC_EXPLORER = "https://testnet.arcscan.app";
export const ARC_CHAIN_ID_HEX = "0x4cef52"; // 5042002
