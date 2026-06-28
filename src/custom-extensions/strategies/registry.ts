import { ResolvedComboTarget } from "@omniroute/open-sse/services/combo.ts";

export type CustomStrategyExecutor = (args: {
  targets: ResolvedComboTarget[];
  comboName: string;
  body: Record<string, unknown>;
  log: any;
}) => ResolvedComboTarget[] | Promise<ResolvedComboTarget[]>;

export const CUSTOM_STRATEGIES: Record<string, CustomStrategyExecutor> = {
  // Add custom strategies here
};
