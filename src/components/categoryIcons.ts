import {
  Network, Monitor, Cpu, AppWindow, Printer, Shield, KeyRound, Folder, Wifi, Server, Cloud, Database,
  Smartphone, Laptop, Mail, Wrench, Terminal, HardDrive, Router, Lock, Globe, Headset, Camera, Code, BookOpen, Settings,
  type LucideIcon,
} from 'lucide-react'

export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  network: Network, monitor: Monitor, cpu: Cpu, 'app-window': AppWindow, printer: Printer, shield: Shield,
  'key-round': KeyRound, folder: Folder, wifi: Wifi, server: Server, cloud: Cloud, database: Database,
  smartphone: Smartphone, laptop: Laptop, mail: Mail, wrench: Wrench, terminal: Terminal, 'hard-drive': HardDrive,
  router: Router, lock: Lock, globe: Globe, headset: Headset, camera: Camera, code: Code, 'book-open': BookOpen, settings: Settings,
}
