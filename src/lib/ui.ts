export interface BaseComponentProps {
  className?: string
  children?: React.ReactNode
}

export type BadgeVariant = 
  | "default" 
  | "secondary" 
  | "destructive" 
  | "outline" 
  | "success" 
  | "warning" 
  | "error"