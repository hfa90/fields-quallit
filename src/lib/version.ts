/** Versão do sistema Fields (definida em package.json e injetada no build) */
export const APP_VERSION = __APP_VERSION__
export const APP_BUILD = __APP_BUILD__
export const APP_BUILD_DATE = __APP_BUILD_DATE__

export function versionLabel() {
  const d = new Date(APP_BUILD_DATE)
  return `v${APP_VERSION} · ${d.toLocaleDateString('pt-BR')}${APP_BUILD !== 'local' ? ` · ${APP_BUILD}` : ''}`
}

/**
 * Histórico de versões (mais recente primeiro).
 * Ao publicar uma versão nova: aumente "version" no package.json e adicione uma entrada aqui.
 */
export const CHANGELOG: { version: string; date: string; title: string; items: string[] }[] = [
  {
    version: '1.6.1', date: '2026-11-13', title: 'Fields pelo Brasil',
    items: [
      'Cada Field aparece com o mapa do estado do seu CD, pintado com a bandeira do estado',
      'O mapa do estado também aparece no perfil de cada Field',
    ],
  },
  {
    version: '1.6.0', date: '2026-11-13', title: 'Voz guiada e time conectado',
    items: [
      'Botão “Contar por voz” em destaque: o Fields conduz a conversa — primeiro o problema, depois como resolveu',
      'Transcrição mais precisa: entende termos como VPN, Wi-Fi, DHCP, Zebra e FortiClient, pontuação falada e “passo um, passo dois”',
      'No app Android a voz agora usa o reconhecimento nativo do celular (atualize o app para a versão 1.1.0)',
      'Cada Field vinculado ao CD onde atua, definido pelo administrador',
      'Equipe Fields na página inicial: veja os colegas, o CD de cada um e as publicações deles',
      'Edição colaborativa: qualquer Field pode melhorar uma publicação, com destaque “Melhorado por” e aviso ao autor',
    ],
  },
  {
    version: '1.5.0', date: '2026-11-13', title: 'Compartilhar ficou mais fácil',
    items: [
      'Dica rápida: registre um problema resolvido em 30 segundos, com foto e ditado por voz',
      'Botão “Obrigado!” para agradecer ao autor de um tutorial',
      'Seu impacto: veja quantos colegas e CDs você ajudou, com resumo toda segunda-feira',
      'Mural “Procuraram e não acharam”: o que os colegas precisam e ainda não existe',
      'Lembrete gentil para contar como resolveu algo que não estava na biblioteca',
      'Versão do sistema e novidades no Perfil',
    ],
  },
  {
    version: '1.4.0', date: '2026-11-13', title: 'Proteção e qualidade',
    items: ['Backup completo para baixar e cópia automática semanal', 'Selo “Verificado” com destaque na busca', 'Correções de telas que não abriam após atualizações'],
  },
  {
    version: '1.3.0', date: '2026-11-11', title: 'App Android',
    items: ['App Android instalável por QR code', 'Comportamento de app nativo no celular (sem zoom acidental)', 'Login restrito a usuários criados pelo administrador'],
  },
  {
    version: '1.2.0', date: '2026-11-11', title: 'Mais produtividade',
    items: ['Rascunho automático e histórico de versões', 'Revisão periódica', 'Modo offline', 'Importar Word e PDF', 'Trilhas de aprendizado'],
  },
  {
    version: '1.1.0', date: '2026-11-11', title: 'Comunidade',
    items: ['Busca inteligente', 'Comentários e “Funcionou para você?”', 'Favoritos, notificações e push', 'Pedidos, ranking e perfis'],
  },
  {
    version: '1.0.0', date: '2026-11-10', title: 'Lançamento',
    items: ['Biblioteca de tutoriais com editor rico, anexos, link curto e “visualizado por”'],
  },
]
