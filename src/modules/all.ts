import type { Module } from "../core/types.js";
import { tenantModule } from "./tenant/tools.js";
import { monitoringModule } from "./monitoring/tools.js";
import { tracingModule } from "./tracing/tools.js";
import { idMapperModule } from "./idmapper/tools.js";
import { idempotentModule } from "./idempotent/tools.js";
import { loggingModule } from "./logging/tools.js";
import { archivingModule } from "./archiving/tools.js";
import { contentModule } from "./content/index.js";
import { logfilesModule } from "./logfiles/tools.js";
import { securityModule } from "./security/index.js";
import { messagestoreModule } from "./messagestore/index.js";
import { b2bModule } from "./b2b/index.js";

export const allModules: Module[] = [tenantModule, monitoringModule, tracingModule, idMapperModule, idempotentModule, loggingModule, archivingModule, contentModule, logfilesModule, securityModule, messagestoreModule, b2bModule];
