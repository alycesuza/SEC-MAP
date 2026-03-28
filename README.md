# Sec-Map: Mapeamento de Competências em Segurança Cibernética

**Sec-Map** é uma ferramenta de mineração de texto projetada para analisar Projetos Pedagógicos de Curso (PPC) e identificar a presença de competências em Segurança Cibernética, baseando-se no referencial do **Índice de Inclusão de Segurança (IIS)**.

## 🖋️ Autoras
Este projeto é baseado no trabalho de:
- **Alyce Silva**
- **Wanessa Borba**

## 🚀 Funcionalidades

- **Análise de PDF**: Extração de texto diretamente de arquivos PDF (PPC).
- **Mineração de Conceitos**: Identificação automática de termos relacionados à segurança cibernética divididos em 5 grupos:
  1. Fundamentos de Segurança
  2. Segurança de Redes e Sistemas
  3. Criptografia e Proteção de Dados
  4. Gestão de Riscos e Governança
  5. Defesa Cibernética e Resposta a Incidentes
- **Cálculo do IIS**: Geração automática de um score (0 a 15) e classificação do curso (Insuficiente, Básico, Adequado, Excelente).
- **Rastreabilidade**: Visualização de trechos do documento onde os termos foram encontrados, com suporte para marcação de **Falsos Positivos**.
- **Tratamento de Falsos Positivos**: O sistema permite identificar termos que aparecem no texto mas não representam competências de segurança (ex: "segurança do trabalho"). Ao marcar como falso positivo, o score é recalculado automaticamente para garantir a precisão científica.
- **Dashboard Visual**: Gráficos de radar e barras para comparação de competências entre diferentes cursos.
- **Exportação**: Suporte para exportação de dados em **CSV** (Planilha) e **Markdown** (Relatório).
- **Persistência Local**: Todos os dados são salvos no navegador (LocalStorage), garantindo privacidade e acesso offline.

## 🛠️ Tecnologias Utilizadas

- **React + TypeScript**: Interface moderna e tipagem segura.
- **Tailwind CSS**: Estilização responsiva e customizada.
- **PDF.js**: Motor de processamento de documentos PDF.
- **Chart.js**: Visualização de dados e gráficos.
- **Framer Motion**: Animações e transições fluidas.
- **Lucide React**: Biblioteca de ícones.

## 📖 Como Usar

1. Acesse a aba **"Nova Mineração"**.
2. Preencha os dados do curso (IES, Nome, Ano, etc.).
3. Faça o upload do arquivo PDF do Projeto Pedagógico do Curso (PPC).
4. Aguarde o processamento e visualize os resultados na aba **"Resultados"**.
5. Revise os termos encontrados na seção de **Rastreabilidade** e marque possíveis falsos positivos para refinar o score.
6. Utilize o **Dashboard** para ter uma visão macro de todos os cursos analisados.

---
*Desenvolvido para fins acadêmicos e de auditoria educacional.*
