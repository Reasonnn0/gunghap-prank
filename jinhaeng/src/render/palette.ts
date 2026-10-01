export const PALETTE = {
  bg: '#0e1110',
  paper: '#d7c4a3',
  dim: '#7d7468',
  fog: '#8fd0c6',
  amber: '#e0a045',
  danger: '#e23d3d',
  memory: '#b9a0e6',
  safe: '#8fbf7a',
  ui: '#c8c2b4',
  flash: '#f4f1ea',
} as const

export const CLIP_COLOR: Record<string, string> = {
  fog_idle: PALETTE.fog,
  speaker_loop: PALETTE.amber,
  tunnel_walk: PALETTE.paper,
  tower_door: PALETTE.ui,
}
