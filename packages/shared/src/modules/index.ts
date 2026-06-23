export {
  MODULE_IDS,
  MODULE_DEFINITIONS,
  getEnabledModules,
  buildNavigation,
  navRoleForContext,
  navKeysForContext,
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
} from "./registry"

export type { TenantConfig, TenantBrand } from "./tenant-config"
