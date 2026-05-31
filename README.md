Markdown
# 🍽️ Lista de Almoço

Sistema frontend para registro, validação e controle de acesso ao almoço de colaboradores. O sistema possui uma interface responsiva dividida em etapas (cards) e consome uma API externa hospedada no Google Apps Script para a validação dos dados.

---

## 🚀 Visão Geral

1. O usuário acessa a plataforma e se depara com a **tela de login**.
2. É solicitado o preenchimento do **CPF**, que recebe uma máscara automática.
3. Se o formato for válido, o sistema libera uma tela para **seleção da unidade** (Sede ou Centro).
4. Após a escolha, o sistema exibe um **loader** e consulta a base de dados via API.
5. A interface exibe o resultado:
   * **Sucesso:** Um ticket verde de "Acesso Liberado" com Nome, Área, Unidade e Horário do colaborador.
   * **Erro/Aviso:** Alertas específicos caso seja fim de semana/feriado, duplicidade de registro no dia, perfil classificado como "Vale Lanche" ou CPF não encontrado.
6. A tela final possui um botão para realizar um **Novo Registro**, reiniciando o ciclo.

---

## 📊 Estrutura do Google Sheets (Banco de Dados)

O sistema exige uma planilha do Google Sheets contendo abas específicas para funcionar corretamente. 

### Abas Obrigatórias:
* **`Usuários`**: Base principal de colaboradores. A leitura é feita a partir da linha 2.
  * *Colunas esperadas (A até G)*: Matrícula, Nome, CPF, Área, Função, Empresa, Departamento.
* **`Registros de Almoço`**: Onde os acessos liberados são gravados. 
  * *Colunas gravadas (A até J)*: Data/Hora, Nome, CPF, Área, Função, Empresa, Matrícula, Observação (Marmita), Unidade, Departamento.
* **`Feriados`**: Controle de bloqueio em dias não úteis.
  * *Coluna A*: Lista de datas de feriados no formato `dd/MM/yyyy`.
* **`Marmita`**: Identificação de colaboradores que levam marmita (adiciona a observação "Marmita" no registro final).
  * *Coluna C*: CPF dos colaboradores.
* **`Vale Lanche`**: Colaboradores que não têm acesso ao refeitório, mas retiram o lanche na cantina.
  * *Coluna C*: CPF dos colaboradores.

---

## 🛠️ Como Executar o Projeto

1.  Certifique-se de que todos os arquivos (`index.html`, `style.css`, `script.js` e `_redirects`) e imagens estejam na mesma pasta.
2.  Publique o repositório em um serviço de hospedagem compatível com o `_redirects` (ex: Netlify).
3.  Garanta que as configurações de fuso horário da planilha e do script no Google apontem para o fuso correto da sua região.
4.  Implante o Google Apps Script como **Aplicativo da Web**, executando como **Você** e com acesso para **Qualquer pessoa**.

---

### Arquivo de Redirecionamento (`_redirects`)
*Crie este arquivo na pasta raiz do projeto*

```text
# Redireciona as chamadas locais de API para o Web App do Google Apps Script
/api/valida-cpf    [https://script.google.com/macros/s/SEU_ID_AQUI/exec](https://script.google.com/macros/s/SEU_ID_AQUI/exec)    200
```

### Código Google Apps Script
Copie e cole este código no editor do Apps Script da sua planilha e gere a implantação.

function doGet(e) {
  try {
    // 1. Pega o CPF e a Unidade enviados via parâmetro na URL
    var cpfInput = e.parameter.cpf;
    var unidadeInput = e.parameter.unidade || "Não informada"; // Captura a unidade

    if (!cpfInput) {
      return responseJSON({ sucesso: false, mensagem: "CPF não informado." });
    }

    // 2. PREPARAÇÃO DE DATAS E VERIFICAÇÃO DE FIM DE SEMANA
    var dataHora = new Date();
    var fusoHorario = Session.getScriptTimeZone();
    var dataFormatada = Utilities.formatDate(dataHora, fusoHorario, "dd/MM/yyyy HH:mm:ss");
    var dataAtualApenas = Utilities.formatDate(dataHora, fusoHorario, "dd/MM/yyyy"); 

    var diaSemana = dataHora.getDay(); // 0 = Domingo, 1 = Seg, ..., 6 = Sábado
    var isFimDeSemana = (diaSemana === 0 || diaSemana === 6);

    // 3. Acessa a planilha e verifica Feriados
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var wsFeriados = ss.getSheetByName('Feriados');
    var isFeriado = false;

    if (wsFeriados) {
      var lastRowFeriados = wsFeriados.getLastRow();
      if (lastRowFeriados >= 2) {
        // Busca a Coluna A da aba Feriados
        var dadosFeriados = wsFeriados.getRange(2, 1, lastRowFeriados - 1, 1).getDisplayValues();
        isFeriado = dadosFeriados.some(function(linhaFeriado) {
          return linhaFeriado[0].trim() === dataAtualApenas;
        });
      }
    }

    // 4. BLOQUEIO DE FIM DE SEMANA OU FERIADO
    if (isFimDeSemana || isFeriado) {
      return responseJSON({ sucesso: false, mensagem: "Registro não autorizado pois está sendo realizado em fim de semana ou feriado" });
    }

    // 5. Acessa as abas principais para validação
    var wsUsuarios = ss.getSheetByName('Usuários');
    var wsRegistros = ss.getSheetByName('Registros de Almoço');
    var wsMarmita = ss.getSheetByName('Marmita');

    if (!wsUsuarios || !wsRegistros) {
      return responseJSON({ sucesso: false, mensagem: "Erro: Abas principais não encontradas." });
    }

    // 6. Busca o usuário na base de dados
    var lastRow = wsUsuarios.getLastRow();
    if (lastRow < 2) return responseJSON({ sucesso: false, mensagem: "Base de dados vazia." });
    
    // Capturando 7 colunas para incluir a Coluna G (Departamento)
    var dados = wsUsuarios.getRange(2, 1, lastRow - 1, 7).getDisplayValues();
    
    // Procura o CPF (Coluna C = índice 2 no array)
    var usuario = dados.find(linha => linha[2] == cpfInput);

    if (usuario) {
      var matricula = usuario[0];
      var nome = usuario[1];
      var cpf = usuario[2];
      var area = usuario[3];
      var funcao = usuario[4];
      var empresa = usuario[5];
      var departamento = usuario[6]; // Índice 6 referente à 7ª coluna
      
      // 7. VERIFICAÇÃO DE DUPLICIDADE NO MESMO DIA
      var lastRowRegistros = wsRegistros.getLastRow();
      if (lastRowRegistros >= 2) { 
        // Pega as colunas A (Data/Hora) e C (CPF) da aba de Registros
        var dadosRegistros = wsRegistros.getRange(2, 1, lastRowRegistros - 1, 3).getDisplayValues();
        
        var jaRegistrouHoje = dadosRegistros.some(function(linhaRegistro) {
          var dataHoraRegistro = linhaRegistro[0]; 
          var dataRegistroApenas = dataHoraRegistro.split(" ")[0]; 
          var cpfRegistro = linhaRegistro[2]; 
          
          return (dataRegistroApenas === dataAtualApenas && cpfRegistro === cpfInput);
        });

        if (jaRegistrouHoje) {
          return responseJSON({ sucesso: false, mensagem: "O colaborador já registrou o almoço hoje." });
        }
      }

      // 8. Verifica se o nome está na aba Marmita (Coluna B)
        var observacao = ""; 

        if (wsMarmita) {
          var lastRowMarmita = wsMarmita.getLastRow();

          if (lastRowMarmita >= 1) {

            // Coluna C = 3
            var cpfMarmita = wsMarmita.getRange(1, 3, lastRowMarmita, 1).getDisplayValues();

            var listaCpfMarmita = cpfMarmita.map(function(linha) {
              return linha[0];
            });

            if (listaCpfMarmita.includes(cpf)) {
              observacao = "Marmita";
            }
          }
        }

      // 9. Registra o acesso
      wsRegistros.appendRow([dataFormatada, nome, cpf, area, funcao, empresa, matricula, observacao, unidadeInput, departamento]);

      // 10. Retorna sucesso
      return responseJSON({
        sucesso: true,
        dados: {
          nome: nome,
          area: area,
          cpf: cpf,
          hora: dataFormatada,
          matricula: matricula,
          funacao: funcao,
          empresa: empresa,
          observacao: observacao,
          unidade: unidadeInput,
          departamento: departamento // Retornando também o departamento no JSON
        }
      });

    } else {
      // 11. Verifica se o CPF está na aba "Vale Lanche"
      var wsValeLanche = ss.getSheetByName('Vale Lanche');
      if (wsValeLanche) {
        var lastRowVL = wsValeLanche.getLastRow();
        if (lastRowVL >= 2) {
          // Busca apenas a coluna C (intervalo de 1 coluna)
          var dadosVL = wsValeLanche.getRange(2, 3, lastRowVL - 1, 1).getDisplayValues();
          
          var isValeLanche = dadosVL.some(function(linhaVL) {
            return linhaVL[0] == cpfInput;
          });

          if (isValeLanche) {
            return responseJSON({ sucesso: false, mensagem: "CPF identificado como Vale-Lanche. Por gentileza retirar o seu lanche na cantina da ZIP" });
          }
        }
      }

      // Caso não encontre nem em Usuários nem em Vale Lanche
      return responseJSON({ sucesso: false, mensagem: "CPF não encontrado. Por gentileza entre em contato com o time de Gente & Gestão" });
    }

  } catch (error) {
    return responseJSON({ sucesso: false, mensagem: "Erro no servidor: " + error.toString() });
  }
}

// Função auxiliar para formatar a saída como JSON
function responseJSON(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
