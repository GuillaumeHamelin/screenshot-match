import {
  Apple,
  CalendarDays,
  ClipboardList,
  Dumbbell,
  LayoutDashboard,
  Ruler,
  Settings,
  Target,
  TrendingUp,
  UserRound,
} from "lucide-react";

export const APP_NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/entrainements", label: "Mes entraînements", icon: Dumbbell },
  { to: "/programmes", label: "Programmes", icon: ClipboardList },
  { to: "/performances", label: "Performances", icon: TrendingUp },
  { to: "/nutrition", label: "Nutrition", icon: Apple },
  { to: "/physique", label: "Suivi physique", icon: Ruler },
  { to: "/calendrier", label: "Calendrier", icon: CalendarDays },
  { to: "/objectifs", label: "Mes objectifs", icon: Target },
  { to: "/profil", label: "Profil", icon: UserRound },
  { to: "/parametres", label: "Paramètres", icon: Settings },
] as const;
