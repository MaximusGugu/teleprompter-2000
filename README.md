# Prompto — Teleprompter

Teleprompter responsivo feito apenas com HTML, CSS e JavaScript. Não há dependências, build ou backend.

## Recursos

- reprodução automática com slider de 30 níveis de velocidade;
- tamanho e cor do texto, espaçamento entre linhas e cor do fundo;
- espelhamento horizontal e vertical;
- direção da rolagem invertida automaticamente no espelhamento vertical;
- direções de leitura discretas com a sintaxe `*pausa*` ou `*respira*`;
- editor e biblioteca de roteiros no navegador (`localStorage`);
- PWA instalável, funcionamento offline, modo tela cheia e layout responsivo;
- modo de apresentação com play/pause persistente e controles temporários ao tocar no texto;
- destaque automático apenas da linha que cruza o centro da tela;
- toggle para ativar ou desativar o destaque da linha;
- botão de reinício automático ao chegar ao fim do roteiro;
- atalhos: `Espaço` reproduz/pausa, `↑`/`↓` mudam a velocidade, `Home` reinicia, `F` abre tela cheia, `E` abre/fecha os roteiros e `Ctrl/Cmd + S` salva.

## Rodar localmente

Abra `index.html` diretamente no navegador ou inicie qualquer servidor estático na pasta.

## Publicar no GitHub Pages

1. Crie um repositório e envie todos os arquivos desta pasta.
2. No GitHub, abra **Settings → Pages**.
3. Em **Build and deployment**, escolha **Deploy from a branch**.
4. Selecione a branch `main`, pasta `/ (root)` e confirme em **Save**.

O app é totalmente local: os roteiros ficam no navegador de cada usuário e não são enviados a nenhum servidor.

No celular, use **Adicionar à tela inicial** ou **Instalar app** no menu do navegador. Ao abrir pelo ícone instalado, o Prompto roda como aplicativo, sem os controles de navegação do browser.
