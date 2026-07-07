export {
  MODULE_IDS,
  MODULE_DEFINITIONS,
  getEnabledModules,
  buildNavigation,
  eligibleRoleLenses,
  isManagerLens,
  navRoleForContext,
  navKeysForContext,
  navRoleForRoleLens,
  resolveRoleLens,
  switchableRoleLenses,
  isCapabilityEnabled,
  isRouteAllowed,
  isApiRouteAllowed,
} from "./registry"

export type {
  ModuleId,
  ModuleDefinition,
  ModuleNavItem,
  ModuleNavSection,
  ModuleNavEntry,
  ModuleCapability,
  NavContext,
  NavContextShape,
  Role,
  RoleLens,
} from "./registry"

export type { TenantConfig, TenantBrand } from "./tenant-config"
