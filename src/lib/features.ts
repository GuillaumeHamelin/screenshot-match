import {
  Apple,
  CalendarDays,
  Dumbbell,
  Ruler,
  Target,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";

export const FEATURES: { icon: LucideIcon; title: string; text: string; points: string[] }[] = [
  {
    icon: Dumbbell,
    title: "Suivi des entraînements",
    text: "Programmes, séances guidées, chronomètre et minuteur de repos.",
    points: [
      "Programmes Push / Pull / Legs, Upper / Lower, Full Body ou sur mesure",
      "Saisie des séries en quelques secondes : charge, reps, RPE / RIR",
      "Résultats de la séance précédente affichés pendant l'effort",
    ],
  },
  {
    icon: TrendingUp,
    title: "Analyse des performances",
    text: "Records, 1RM estimé et courbes de progression par exercice.",
    points: [
      "Détection automatique des records personnels",
      "1RM estimé, meilleure série, volume total",
      "Filtres de 7 jours à toutes les données",
    ],
  },
  {
    icon: Apple,
    title: "Suivi nutritionnel",
    text: "Journal alimentaire, macros calculées et hydratation.",
    points: [
      "Recherche dans une vraie base d'aliments",
      "Calories et macros calculées selon la quantité",
      "Repas favoris réutilisables",
    ],
  },
  {
    icon: Ruler,
    title: "Progression physique",
    text: "Poids, masse grasse, mensurations et photos privées.",
    points: [
      "Poids, masse grasse, masse musculaire",
      "Tours de taille, poitrine, bras, cuisse, mollet",
      "Graphiques d'évolution par période",
    ],
  },
  {
    icon: Target,
    title: "Objectifs personnalisés",
    text: "Force, physique, nutrition : fixe tes cibles et mesure l'écart.",
    points: [
      "Valeur initiale, actuelle et cible",
      "Pourcentage de progression",
      "Date limite optionnelle",
    ],
  },
  {
    icon: CalendarDays,
    title: "Calendrier sportif",
    text: "Planifie, déplace et retrouve toutes tes séances.",
    points: [
      "Vue mensuelle et hebdomadaire",
      "Séances prévues, terminées ou manquées",
      "Jours de repos visibles d'un coup d'œil",
    ],
  },
];
