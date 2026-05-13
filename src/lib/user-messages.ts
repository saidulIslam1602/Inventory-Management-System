/**
 * Consistent user-facing copy for server actions, API JSON, and client fallbacks.
 * No server-only imports — safe to use from client components.
 */

export const UserMessage = {
  auth: {
    signInRequired: "You need to sign in to continue.",
  },
  permission: {
    denied: "You don't have permission to do that.",
    deniedForAction: "You don't have permission for this action.",
  },
  validation: {
    invalidInput: "Something in the form isn't valid. Please check your input and try again.",
  },
  error: {
    generic: "Something went wrong. Please try again.",
    contactNotSaved: "Your contact information could not be saved. Please try again.",
  },
  api: {
    unauthorized: "You need to sign in to continue.",
    forbidden: "You don't have access to this.",
    invalidSearch: "Invalid search request.",
    invalidExportFilters: "Invalid export filters.",
    noEmployeeLinked: "No employee profile is linked to your account.",
    cronNotConfigured: "Scheduled email is not configured on the server.",
    cronUnauthorized: "Invalid or missing scheduler credentials.",
  },
} as const;
