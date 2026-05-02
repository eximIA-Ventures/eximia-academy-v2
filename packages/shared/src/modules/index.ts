export {
  MODULE_IDS,
  MODULE_DEFINITIONS,
  getEnabledModules,
  buildNavigation,
  isRouteAllowed,
  isApiRouteAllowed,
} from "./registry"

export type {
  ModuleId,
  ModuleDefinition,
  ModuleNavItem,
  ModuleNavSection,
  ModuleNavEntry,
  Role,
} from "./registry"

export type { TenantConfig, TenantBrand } from "./tenant-config"
