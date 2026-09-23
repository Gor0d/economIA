# Internacionalização da EconomIA

## Objetivo

Levar o produto a outros mercados sem duplicar regras de cálculo, catálogo de preços ou componentes. Português do Brasil continua sendo o idioma padrão. Inglês deve ser o primeiro idioma público adicional.

## Base implementada

- `i18n.js` concentra locales suportados, persistência da preferência e formatação regional.
- O catálogo começa com termos compartilhados e aceita expansão por chaves estáveis.
- Números, moedas e datas possuem formatadores independentes dos cálculos.
- A API funciona no navegador e no Node, permitindo testes sem dependências externas.
- Nenhum seletor público é exibido enquanto a tradução completa e a revisão humana não estiverem prontas.

## Lançamento recomendado

1. Extrair todos os textos do HTML, `app.js` e `context-app.js` para catálogos `pt-BR` e `en`.
2. Revisar o inglês com alguém fluente, principalmente termos de cobrança, cache e contexto.
3. Publicar uma URL rastreável por idioma, como `/en/`, mantendo `/` em português.
4. Adicionar `hreflang`, canonical, sitemap e metadados sociais específicos por idioma.
5. Mostrar o seletor de idioma e persistir a preferência somente depois da página em inglês estar completa.
6. Medir origem, idioma, conversão e uso das calculadoras separadamente.

## Impacto esperado

- **Produto:** médio. Existem muitos textos dinâmicos, mensagens de erro e recomendações geradas em JavaScript.
- **SEO:** alto potencial, mas apenas com URLs próprias renderizáveis. Troca de idioma somente no cliente tem alcance menor em busca orgânica.
- **Manutenção:** baixo a médio depois da extração. Todo texto novo precisará de tradução e revisão.
- **Qualidade:** exige testes por locale, revisão de overflow e conferência de leitores de tela.
- **Catálogo de preços:** baixo impacto. Nomes, valores e fontes oficiais continuam únicos; apenas rótulos e formatação mudam.
- **Privacidade e desempenho:** impacto mínimo com catálogos locais, sem serviço externo de tradução em tempo de execução.

## Decisões

- Não traduzir nomes oficiais de modelos e provedores.
- Manter USD e BRL disponíveis em todos os idiomas.
- Usar o locale para apresentação, nunca para alterar fórmulas ou precisão.
- Não detectar e trocar idioma automaticamente sem uma opção clara de retorno.
- Evitar uma experiência parcialmente traduzida.
