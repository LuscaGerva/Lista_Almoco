// URL da API que será consultada
const API_URL = "/api/valida-cpf"; 

// =========================================================
// SELEÇÃO DE ELEMENTOS DO DOM (HTML)
// =========================================================

// Elementos do formulário e feedback
const form = document.getElementById('form-acesso');
const cpfInput = document.getElementById('cpf');
const btnValidar = document.getElementById('btn-validar');
const btnNovo = document.getElementById('btn-novo');
const divLoading = document.getElementById('loading');
const divErro = document.getElementById('erro-msg');

// Telas (Cards) que serão exibidas/ocultadas
const telaLogin = document.getElementById('tela-login');
const telaUnidade = document.getElementById('tela-unidade');
const telaSucesso = document.getElementById('tela-sucesso');

// Botões da tela de escolha de unidade
const btnSede = document.getElementById('btn-sede');
const btnCentro = document.getElementById('btn-centro');
const btnVoltarUnidade = document.getElementById('btn-voltar-unidade');

// =========================================================
// VARIÁVEIS GLOBAIS
// =========================================================

// Armazena o CPF digitado para uso posterior na chamada da API
let cpfAtual = ""; 

// =========================================================
// FUNÇÕES UTILITÁRIAS PARA CPF
// =========================================================

/**
 * Remove qualquer caractere não numérico do CPF e garante 11 dígitos.
 * Ideal para enviar dados limpos para a API.
 */
function normalizarCpfParaConsulta(rawCpf) {
    // Remove tudo que não for número
    const digits = String(rawCpf ?? "")
        .trim()
        .replace(/\D/g, "");

    if (digits.length === 0) return "";
    
    // Quando a base perde zeros à esquerda (ex: "999999999" ao invés de "00999999999"), reconstroi adicionando zeros.
    return digits.length > 11 ? digits.slice(0, 11) : digits.padStart(11, "0");
}

/**
 * Aplica a máscara visual padrão de CPF (000.000.000-00).
 */
function formatarCpf(digits11) {
    // Espera-se 11 dígitos numéricos.
    if (!digits11 || digits11.length !== 11) return digits11;
    return digits11.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

// =========================================================
// EVENTOS E REGRAS DE NEGÓCIO
// =========================================================

// 1. MÁSCARA DINÂMICA DE CPF (Enquanto o usuário digita)
cpfInput.addEventListener('input', (e) => {
    // Remove não números
    let v = e.target.value.replace(/\D/g, "");
    
    // Limita a 11 números
    if (v.length > 11) v = v.slice(0, 11);
    
    // Aplica a formatação com base na quantidade de números digitados
    if (v.length > 9) v = v.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    else if (v.length > 6) v = v.replace(/(\d{3})(\d{3})(\d{3})/, "$1.$2.$3");
    else if (v.length > 3) v = v.replace(/(\d{3})(\d{3})/, "$1.$2");
    
    // Atualiza o valor no input de texto
    e.target.value = v;
});

// 2. ENVIO DO FORMULÁRIO (Tela de Login)
form.addEventListener('submit', (e) => {
    e.preventDefault(); // Evita que a página recarregue
    
    // Extrai apenas os números do CPF digitado
    const digits = cpfInput.value ? cpfInput.value.trim().replace(/\D/g, "") : "";
    
    // Aceita CPFs com menos dígitos quando vierem "mutilados" (ex: 999999999 => padStart => 00999999999).
    if (digits.length < 9) {
        mostrarErro("CPF incompleto.");
        return; // Interrompe a execução
    }

    // Normaliza e armazena o CPF na variável global
    cpfAtual = formatarCpf(normalizarCpfParaConsulta(digits));

    // Oculta a tela de login e possíveis erros, mostra a tela de escolha de unidade
    divErro.classList.add('hidden');
    telaLogin.classList.add('hidden');
    telaUnidade.classList.remove('hidden');
});

// Botão Voltar (Retorna para a tela de digitar o CPF)
btnVoltarUnidade.addEventListener('click', () => {
    telaUnidade.classList.add('hidden');
    telaLogin.classList.remove('hidden');
});

// 3. SELEÇÃO DA UNIDADE E ENVIO PARA A API
// Aciona a função principal passando a unidade escolhida
btnSede.addEventListener('click', () => confirmarUnidadeEEnviar('SEDE'));
btnCentro.addEventListener('click', () => confirmarUnidadeEEnviar('CENTRO'));

/**
 * Função assíncrona que envia os dados (CPF e Unidade) para a API.
 */
async function confirmarUnidadeEEnviar(unidadeSelecionada) {
    // Ajuste visual: oculta a unidade e mostra o "loading"
    telaUnidade.classList.add('hidden');
    divLoading.classList.remove('hidden');
    divErro.classList.add('hidden');

    try {
        // Dispara a requisição GET para a API anexando CPF e Unidade na URL
        const response = await fetch(`${API_URL}?cpf=${encodeURIComponent(cpfAtual)}&unidade=${encodeURIComponent(unidadeSelecionada)}`);
        
        // Transforma a resposta em formato JSON
        const data = await response.json();

        // Verifica a propriedade 'sucesso' retornada pela API
        if (data.sucesso) {
            exibirSucesso(data.dados, unidadeSelecionada);
        } else {
            // Caso negativo, lança um erro para cair no bloco 'catch' abaixo
            throw new Error(data.mensagem || "Erro desconhecido.");
        }

    } catch (error) {
        // Em caso de falha na comunicação ou validação
        console.error(error);
        mostrarErro(error.message || "Erro ao conectar com o servidor.");
        
        // Se der erro, tira o loading e volta para a tela inicial de login
        divLoading.classList.add('hidden');
        telaLogin.classList.remove('hidden');
    } finally {
        // Independentemente de dar certo ou errado, oculta o 'loading' no final
        divLoading.classList.add('hidden');
    }
}

// 4. FUNÇÕES DE FEEDBACK VISUAL

/**
 * Preenche o ticket de sucesso com os dados da API e exibe a tela.
 */
function exibirSucesso(dados, unidadeSelecionada) {
    // Injeta os dados recebidos nos campos (spans) HTML
    document.getElementById('res-nome').innerText = dados.nome;
    document.getElementById('res-area').innerText = dados.area;
    document.getElementById('res-hora').innerText = dados.hora;
    document.getElementById('res-unidade').innerText = unidadeSelecionada;

    // Gerencia as telas: esconde tudo, menos a tela de sucesso
    telaLogin.classList.add('hidden');
    telaUnidade.classList.add('hidden');
    divLoading.classList.add('hidden');
    telaSucesso.classList.remove('hidden');
}

/**
 * Exibe a barra vermelha de erro com a mensagem fornecida.
 */
function mostrarErro(msg) {
    divErro.innerText = msg;
    divErro.classList.remove('hidden');
}

// 5. BOTÃO "NOVO REGISTRO" (Reseta a aplicação)
btnNovo.addEventListener('click', () => {
    // Limpa campos e variáveis
    cpfInput.value = '';
    cpfAtual = '';
    
    // Gerencia as telas: volta para o login
    telaSucesso.classList.add('hidden');
    telaUnidade.classList.add('hidden');
    telaLogin.classList.remove('hidden');
    divErro.classList.add('hidden');
    
    // Dá foco (coloca o cursor piscando) no input de CPF após um breve tempo
    setTimeout(() => cpfInput.focus(), 100);
});