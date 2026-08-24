"use client";

import { useMemo } from "react";
import { AppKit } from "@circle-fin/app-kit";
import type { EIP1193Provider } from "viem";
import { createViemAdapterFromProvider } from "@circle-fin/adapter-viem-v2";

let kit: AppKit | null = null;

export function getAppKit(): AppKit {
  if (!kit) kit = new AppKit();
  return kit;
}

export async function makeAdapter(provider: EIP1193Provider) {
  return createViemAdapterFromProvider({ provider });
}
