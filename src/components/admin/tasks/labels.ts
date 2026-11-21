export const PRIORITY_STYLES: Record<string, { label: string; className: string }> = {
  low: { label: "Basse", className: "bg-surface text-muted-foreground" },
  medium: { label: "Normale", className: "bg-info/10 text-info" },
  high: { label: "Haute", className: "bg-warning/10 text-warning" },
  urgent: { label: "Urgente", className: "bg-destructive/10 text-destructive" },
};
