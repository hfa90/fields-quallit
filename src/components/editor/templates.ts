// Modelos prontos para deixar qualquer tutorial organizado e bonito automaticamente
export const TEMPLATES: { id: string; name: string; description: string; html: string }[] = [
  {
    id: 'passo-a-passo',
    name: 'Passo a passo',
    description: 'Objetivo, pré-requisitos, etapas numeradas e validação',
    html: `
<h2>Objetivo</h2>
<p>Descreva em uma frase o que este tutorial resolve.</p>
<div data-callout="info"><p><strong>Quando usar:</strong> descreva a situação em que o field deve seguir este procedimento.</p></div>
<h2>Pré-requisitos</h2>
<ul data-type="taskList">
  <li data-type="taskItem" data-checked="false"><p>Acesso de administrador na máquina</p></li>
  <li data-type="taskItem" data-checked="false"><p>Conexão com a internet</p></li>
  <li data-type="taskItem" data-checked="false"><p>Credenciais / arquivos necessários</p></li>
</ul>
<h2>Passo a passo</h2>
<ol>
  <li><p><strong>Primeiro passo</strong> — explique o que fazer.</p></li>
  <li><p><strong>Segundo passo</strong> — inclua prints para facilitar.</p></li>
  <li><p><strong>Terceiro passo</strong> — se houver comando, use um bloco de código:</p></li>
</ol>
<pre><code class="language-bash">comando --exemplo</code></pre>
<div data-callout="warning"><p>Destaque aqui algo que costuma dar errado.</p></div>
<h2>Como validar</h2>
<div data-callout="success"><p>Descreva o resultado esperado ao final do procedimento.</p></div>
<h2>Solução de problemas</h2>
<table><tbody>
<tr><th><p>Problema</p></th><th><p>Causa provável</p></th><th><p>Solução</p></th></tr>
<tr><td><p>Mensagem de erro X</p></td><td><p>…</p></td><td><p>…</p></td></tr>
</tbody></table>`,
  },
  {
    id: 'vpn',
    name: 'Configuração de VPN',
    description: 'Estrutura pronta para tutoriais de VPN',
    html: `
<h2>Objetivo</h2>
<p>Configurar a VPN corporativa para acesso remoto seguro à rede interna.</p>
<h2>O que você vai precisar</h2>
<ul data-type="taskList">
  <li data-type="taskItem" data-checked="false"><p>Cliente VPN instalado (ex.: FortiClient / OpenVPN / WireGuard)</p></li>
  <li data-type="taskItem" data-checked="false"><p>Arquivo de configuração (anexado neste tutorial)</p></li>
  <li data-type="taskItem" data-checked="false"><p>Usuário e senha de rede</p></li>
</ul>
<h2>Configuração</h2>
<ol>
  <li><p>Abra o cliente VPN e clique em <strong>Nova conexão</strong>.</p></li>
  <li><p>Preencha <strong>Servidor</strong> e <strong>Porta</strong> conforme a tabela abaixo.</p></li>
  <li><p>Importe o arquivo de configuração anexado.</p></li>
  <li><p>Salve e clique em <strong>Conectar</strong>.</p></li>
</ol>
<table><tbody>
<tr><th><p>Campo</p></th><th><p>Valor</p></th></tr>
<tr><td><p>Servidor</p></td><td><p>vpn.empresa.com.br</p></td></tr>
<tr><td><p>Porta</p></td><td><p>443</p></td></tr>
</tbody></table>
<div data-callout="danger"><p>Nunca compartilhe o arquivo de configuração fora da equipe.</p></div>
<h2>Teste de conexão</h2>
<pre><code class="language-powershell">Test-NetConnection servidor-interno -Port 3389</code></pre>
<div data-callout="success"><p>Se o resultado mostrar <code>TcpTestSucceeded : True</code>, a VPN está funcionando.</p></div>`,
  },
  {
    id: 'instalacao',
    name: 'Instalação de sistema',
    description: 'Para instalação de SO ou softwares (ex.: Linux)',
    html: `
<h2>Objetivo</h2>
<p>Instalar o sistema do zero com as configurações padrão da empresa.</p>
<h2>Requisitos mínimos</h2>
<table><tbody>
<tr><th><p>Item</p></th><th><p>Mínimo</p></th><th><p>Recomendado</p></th></tr>
<tr><td><p>Memória</p></td><td><p>4 GB</p></td><td><p>8 GB</p></td></tr>
<tr><td><p>Disco</p></td><td><p>25 GB</p></td><td><p>50 GB SSD</p></td></tr>
</tbody></table>
<h2>Preparação</h2>
<ol>
  <li><p>Baixe a imagem ISO oficial (link na seção <strong>Links úteis</strong>).</p></li>
  <li><p>Crie o pendrive bootável com Rufus/Balena Etcher.</p></li>
  <li><p>Dê boot pelo pendrive (F12 / F9 / ESC, conforme o fabricante).</p></li>
</ol>
<div data-callout="tip"><p>Desative o <strong>Secure Boot</strong> se o pendrive não aparecer na lista de boot.</p></div>
<h2>Instalação</h2>
<ol>
  <li><p>Selecione idioma <strong>Português (Brasil)</strong> e teclado <strong>ABNT2</strong>.</p></li>
  <li><p>Escolha o particionamento.</p></li>
  <li><p>Defina usuário e nome do computador conforme o padrão.</p></li>
</ol>
<h2>Pós-instalação</h2>
<pre><code class="language-bash">sudo apt update &amp;&amp; sudo apt upgrade -y</code></pre>
<div data-callout="success"><p>Sistema instalado e atualizado.</p></div>`,
  },
]
