export const TOKENS = [
  {
    symbol: "USDC",
    displaySymbol: "USDC",
    name: "USD Coin",
    subLabel: null,
    logo: "/tokens/usdc.png",
    color: "#2775CA",
    glyph: "$",
  },
  {
    symbol: "EURC",
    displaySymbol: "EURC",
    name: "Euro Coin",
    subLabel: null,
    logo: "/tokens/eurc.png",
    color: "#0EA5E9",
    glyph: "€",
  },
  {
    symbol: "NATIVE",
    displaySymbol: "USDC",
    name: "USDC",
    subLabel: "Gas token",
    logo: "/tokens/usdc.png",
    color: "#111827",
    glyph: "⛽",
  },
] as const;

export type TokenSymbol = (typeof TOKENS)[number]["symbol"];
export type TokenMeta = (typeof TOKENS)[number];

/** Symbol shown in the UI — NATIVE is displayed as "USDC" (gas token). */
export function displaySymbolOf(meta: Pick<TokenMeta, "displaySymbol">) {
  return meta.displaySymbol;
}

export function tokenMeta(symbol: string): TokenMeta {
  return TOKENS.find((t) => t.symbol === symbol) ?? TOKENS[0];
}

export const ARC_EXPLORER = "https://testnet.arcscan.app";
export const ARC_CHAIN_ID_HEX = "0x4cef52"; // 5042002
