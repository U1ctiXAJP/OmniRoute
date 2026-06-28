/**
 * Custom authorization middleware for downstream fork customizations.
 * These functions run during the authorization pipeline.
 */

export type CustomMiddleware = (
  req: any,
  res: any,
  next: () => void
) => Promise<void> | void;

export const CUSTOM_MIDDLEWARE: CustomMiddleware[] = [
  // Example:
  // async (req, res, next) => { ... next(); }
];
