# Creass · Reumatologia e Especialidades Médicas

Landing page da **Creass Reumatologia e Especialidades Médicas** (R. Santana, 187 — Centro, Mogi das Cruzes · SP).

Site estático, sem dependências nem etapa de build: HTML, CSS e JavaScript puros, com fontes auto-hospedadas.

## Destaques

- **Hero interativo**: esfera de partículas em `<canvas>` que gira com o mouse, abre uma "lente" ao redor do cursor e se dissolve ao rolar a página.
- **Rolagem**: tema que alterna suavemente entre escuro e claro a cada seção, títulos revelados palavra por palavra, manifesto que "acende" conforme a leitura, faixa contínua que acelera com a velocidade da rolagem, contadores estilo odômetro e a jornada do paciente em rolagem horizontal fixa.
- **Cursor**: cursor próprio com anel em atraso, botões magnéticos, cards com holofote e bordas que acendem perto do cursor, lista de especialidades com preenchimento que segue a direção de entrada e assinatura do rodapé que fica em itálico ao passar o mouse.
- **Agendamento pelo WhatsApp**: formulário que monta a mensagem (nome, especialidade, período, convênio) e abre a conversa já pronta. Nenhum dado é armazenado.
- **Status em tempo real**: "Aberto agora / Fechado · abre amanhã às 8h", calculado no fuso de São Paulo.
- **Acessibilidade e SEO**: HTML semântico, navegação por teclado, respeito a `prefers-reduced-motion`, funciona sem JavaScript, dados estruturados (`MedicalClinic` e `FAQPage`), Open Graph e contraste AA.

## Estrutura

```
index.html                 Página (conteúdo e textos)
assets/css/styles.css      Estilos, temas e responsividade
assets/js/main.js          Interações (bloco CONFIG no topo)
assets/fonts/              Instrument Serif, Geist e Geist Mono (licença OFL)
assets/img/                Favicon, ícone Apple e imagem de compartilhamento
```

## Rodar localmente

```bash
python3 -m http.server 8000
# abra http://localhost:8000
```

## Como editar

| O quê | Onde |
| --- | --- |
| Número do WhatsApp | Procure e substitua `5511933771629` em `index.html` e `assets/js/main.js` (e `(11) 93377-1629` nos textos visíveis) |
| Horário de funcionamento | `CONFIG.hours` em `assets/js/main.js`, os textos de "Horários" em `index.html` e `openingHoursSpecification` no JSON-LD |
| Especialidades | Lista `.spec-list`, as opções do formulário (`name="especialidade"`) e o número "06" das estatísticas em `index.html` |
| Médica responsável / CRM | Seção `#medica` e rodapé em `index.html` |
| Domínio final | Atualize `og:image` (e adicione `og:url`/`canonical`) com a URL completa do site |

Para trocar o monograma da seção da médica por uma foto, substitua o conteúdo de `.doctor__visual` por um `<img>`.

## Publicação

Por ser estático, pode ser publicado em qualquer hospedagem. No **GitHub Pages**: *Settings → Pages → Deploy from a branch*, escolha a branch e a pasta `/ (root)`.

## Dados a confirmar com a clínica

As informações foram reunidas a partir do Instagram, do Google Maps e de diretórios públicos, que às vezes divergem:

- **WhatsApp**: `(11) 93377-1629` (Instagram e ficha do Google). O Facebook mostra `(11) 94585-8747`.
- **Horário**: segunda a quinta, 8h às 17h; sexta, 8h30 às 17h (ficha pública).
- **Especialidades**: reumatologia, endocrinologia, angiologia, geriatria, ginecologia e clínica médica.
- **CRM-SP 99852** da Dra. Andrea Soares dos Santos e **RQE** (não encontrado — a Resolução CFM nº 2.336/2023 pede o RQE ao divulgar a especialidade).
- **Convênios aceitos** e o **logotipo oficial** (o símbolo atual é provisório).
