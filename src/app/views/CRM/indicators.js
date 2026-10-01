import { Users, Phone, BadgeCheck, CalendarDays, CheckCircle2, Activity, RefreshCw } from "lucide-react";
import { INDICATOR_DEFINITIONS } from "./command-metrics.js";
const ICONS = { assigned: Users, contacted: Phone, qualified: BadgeCheck, zoomScheduled: CalendarDays, zoomDone: CheckCircle2, activePostZoom: Activity, followUps: RefreshCw };
export const INDICATORS = INDICATOR_DEFINITIONS.map(indicator => ({ ...indicator, icon: ICONS[indicator.key] }));

