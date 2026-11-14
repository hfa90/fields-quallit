/** Título da aba do navegador, sempre no mesmo padrão: "Página · Fields Quallit" */
export const APP_TITLE = 'Fields Quallit'
export function setPageTitle(page?: string | null) {
  document.title = page ? `${page} · ${APP_TITLE}` : APP_TITLE
}

const ROUTE_TITLES: [RegExp, string][] = [
  [/^\/$/, 'Biblioteca'],
  [/^\/meus/, 'Meus tutoriais'],
  [/^\/busca/, 'Buscar'],
  [/^\/notificacoes/, 'Notificações'],
  [/^\/comunidade\/pedido\//, 'Pedido da comunidade'],
  [/^\/comunidade/, 'Comunidade'],
  [/^\/pessoa\//, 'Perfil'],
  [/^\/trilhas/, 'Trilhas'],
  [/^\/novo/, 'Novo tutorial'],
  [/^\/dica/, 'Dica rápida'],
  [/^\/t\/[^/]+\/editar/, 'Editar tutorial'],
  [/^\/perfil/, 'Conta e preferências'],
  [/^\/admin/, 'Administração'],
]

/** Título padrão de cada tela (a tela do tutorial define o próprio, com o nome dele) */
export function titleForPath(path: string): string | null | undefined {
  if (/^\/t\/[^/]+\/?$/.test(path)) return undefined // a própria tela cuida
  return ROUTE_TITLES.find(([re]) => re.test(path))?.[1] ?? null
}
