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
    version: '1.12.0', date: '2026-11-13', title: 'O robozinho tira o QR do bolso',
    items: [
      'O robozinho agora tem um bolso: depois de chegar (ou de cumprimentar), ele procura lá dentro e tira o QR code do app',
      'No computador, é só apontar a câmera do celular para o QR na mão dele; no celular Android, ele entrega o botão de baixar',
      'Tocar no robô mostra o QR de novo; ao ir para o e-mail ou fechar o cartão, ele guarda de volta no bolso',
      'Nas outras telas do computador, o robozinho que entra pela lateral também mostra o QR',
    ],
  },
  {
    version: '1.11.0', date: '2026-11-13', title: 'O robozinho ganhou pernas',
    items: [
      'No login, o robozinho chega andando devagar pela lateral',
      'Ao passar o mouse (ou tocar) no e-mail, ele corre para perto para ver quem está entrando',
      'Reconhece quem já entrou neste aparelho e cumprimenta com uma gíria do estado do seu CD',
      'Digitando a senha ele vai embora tristonho, para e olha para trás… e ao clicar em Entrar sai correndo chorando',
    ],
  },
  {
    version: '1.10.0', date: '2026-11-13', title: 'O robozinho do app',
    items: [
      'O cartão grande do app Android saiu da página inicial',
      'No lugar, o robozinho Android entra pela lateral uma única vez, pede para ser instalado e sai do mesmo jeito',
      'Depois fica só a cabecinha espiando na lateral das telas — toque nela para instalar ou “Não mostrar mais”',
      'Na tela de login, o robozinho acompanha você: fica triste no e-mail, se desespera na senha, aceita… e se despede antes de entrar',
    ],
  },
  {
    version: '1.9.0', date: '2026-11-13', title: 'Página inicial mais leve',
    items: [
      'Boas-vindas para quem acabou de chegar: um tour rápido de como buscar, compartilhar por voz e ganhar pontos (dá para rever no Perfil)',
      '“Continuar lendo” e “Favoritos” juntos numa faixa só, com abas',
      '“Carregar mais” em Todos os tutoriais, de 100 em 100',
      '“Resolveu algo hoje?” aparece só uma vez por dia',
      'O cartão do app Android some para quem já usa o app ou tocou em “Já tenho o app”',
    ],
  },
  {
    version: '1.8.0', date: '2026-11-13', title: 'Do seu jeito',
    items: [
      'Novos modos de ver os tutoriais: Cartões, Lista, Compacto e Por categoria',
      'O modo escolhido fica salvo na sua conta e abre igual no site e no app',
      'No computador, as faixas laterais (Fields pelo Brasil, Continuar lendo…) têm setas e podem ser arrastadas com o mouse',
      'Mais espaço no fim de todas as telas',
    ],
  },
  {
    version: '1.7.1', date: '2026-11-13', title: 'Excluir Field',
    items: [
      'Administrador pode excluir um Field pela lista de usuários ou pelo perfil rápido',
      'Antes de excluir, escolha se as publicações serão transferidas para outra pessoa ou apagadas',
      'Quem também usa o Inventário perde só o acesso ao Fields; a conta do Inventário continua',
    ],
  },
  {
    version: '1.7.0', date: '2026-11-13', title: 'Novos estados e perfil rápido',
    items: [
      'Ao cadastrar um Field, o administrador pode criar um novo estado/CD: o desenho do estado aparece ao digitar o nome ou a sigla',
      'Passe o mouse sobre um Field para ver um resumo (CD, nível, publicações e pontos)',
      'Clique no Field para abrir o perfil completo: estatísticas, impacto e publicações recentes',
    ],
  },
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
