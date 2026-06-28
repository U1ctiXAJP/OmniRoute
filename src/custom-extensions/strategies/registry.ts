/**
 * Custom routing strategies for downstream fork customizations.
 * Implement your custom target reordering or filtering logic here.
 */

export type CustomStrategyExecutor = (args: {
  targets: any[];
  comboName: string;
  body: Record<string, any>;
  log: any;
}) => Promise<any[]> | any[];

export const CUSTOM_STRATEGIES: Record<string, CustomStrategyExecutor> = {
  // Example:
  // "my-custom-strategy": ({ targets }) => targets.reverse(),
};
