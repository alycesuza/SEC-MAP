/**
 * Interface que define um Conceito de Segurança Cibernética.
 */
export interface Concept {
  id: string;      // Identificador único (ex: SS01)
  nome: string;    // Nome legível do conceito
  peso: number;    // Peso para o cálculo do IIS (1 a 5)
  tokens: string[]; // Lista de termos/palavras-chave para busca
}

/**
 * Interface que agrupa conceitos em categorias (Grupos).
 */
export interface Group {
  grupo: string;       // Nome do grupo de competências
  conceitos: Concept[]; // Lista de conceitos pertencentes ao grupo
}

/**
 * DICIONÁRIO DE REFERÊNCIA (Baseado no referencial de Alyce Silva e Wanessa Borba)
 * Contém os termos técnicos e pesos utilizados na mineração.
 */
export const DICTIONARY: Group[] = [
  {
    "grupo": "Segurança de Software",
    "conceitos": [
      { "id": "SS01", "nome": "Secure Coding", "peso": 5, "tokens": ["secure coding", "programação segura", "desenvolvimento seguro", "desenvolvimento de software seguro", "coding seguro"] },
      { "id": "SS02", "nome": "Web Vulnerabilities", "peso": 5, "tokens": ["owasp", "top 10", "sql injection", "injeção de sql", "cross-site scripting", "xss", "csrf"] },
      { "id": "SS03", "nome": "Memory Safety", "peso": 5, "tokens": ["buffer overflow", "estouro de buffer", "memory corruption", "cwe-119"] },
      { "id": "SS04", "nome": "Security Testing", "peso": 4, "tokens": ["sast", "dast", "analise estatica", "analise dinamica", "fuzzing", "code review", "revisao de codigo"] },
      { "id": "SS05", "nome": "Secure SDLC", "peso": 3, "tokens": ["sdl", "sdlc seguro", "devsecops", "security by design", "software development lifecycle"] },
      { "id": "SS06", "nome": "Defensive Programming", "peso": 2, "tokens": ["validacao de entrada", "input validation", "tratamento de exceções", "sanitização"] }
    ]
  },
  {
    "grupo": "Segurança de Dados",
    "conceitos": [
      { "id": "DS01", "nome": "Privacy Architecture", "peso": 5, "tokens": ["privacy by design", "privacidade desde a concepção", "privacidade diferencial", "differential privacy"] },
      { "id": "DS02", "nome": "Data Protection", "peso": 4, "tokens": ["anonimização", "anonymization", "mascaramento de dados", "data masking", "pii", "dados sensíveis"] },
      { "id": "DS03", "nome": "Integrity & Authenticity", "peso": 4, "tokens": ["integridade de dados", "assinatura digital", "digital signature", "hashing"] },
      { "id": "DS04", "nome": "Cryptographic Concepts", "peso": 4, "tokens": ["criptografia", "cryptography", "cifra", "encryption"] },
      { "id": "DS05", "nome": "Data Lifecycle", "peso": 2, "tokens": ["ciclo de vida dos dados", "descarte seguro", "retencao de dados"] }
    ]
  },
  {
    "grupo": "Segurança de Conexões",
    "conceitos": [
      { "id": "CN01", "nome": "Modern Network Defense", "peso": 5, "tokens": ["zero trust", "confiança zero", "software defined security", "microssegmentação"] },
      { "id": "CN02", "nome": "Secure Protocols", "peso": 4, "tokens": ["tls", "ssl", "ipsec", "ssh", "https", "protocolos seguros"] },
      { "id": "CN03", "nome": "Network Controls", "peso": 4, "tokens": ["firewall", "ids", "ips", "vpn", "proxy seguro", "honeypot"] },
      { "id": "CN04", "nome": "Threat Detection", "peso": 3, "tokens": ["analise de trafego", "sniffing", "port scanning", "varredura de portas"] },
      { "id": "CN05", "nome": "Network Fundamentals", "peso": 1, "tokens": ["redes de computadores", "roteamento", "tcp/ip"] }
    ]
  },
  {
    "grupo": "Segurança de Componentes",
    "conceitos": [
      { "id": "CP01", "nome": "Hardware Trust", "peso": 5, "tokens": ["trusted computing", "root of trust", "secure boot", "tpm", "hsm"] },
      { "id": "CP02", "nome": "Embedded Security", "peso": 4, "tokens": ["segurança de firmware", "arm trustzone", "iot security", "segurança de sistemas embarcados"] },
      { "id": "CP03", "nome": "System Hardening", "peso": 3, "tokens": ["hardening", "end-point security", "seguranca de dispositivos"] }
    ]
  },
  {
    "grupo": "Segurança de Sistemas",
    "conceitos": [
      { "id": "SY01", "nome": "Access Control Models", "peso": 5, "tokens": ["rbac", "abac", "mac", "controle de acesso baseado em atributos"] },
      { "id": "SY02", "nome": "Virtualization Security", "peso": 4, "tokens": ["segurança de containers", "docker security", "isolamento", "sandboxing", "hypervisor security"] },
      { "id": "SY03", "nome": "OS Security", "peso": 3, "tokens": ["segurança de sistemas operacionais", "kernel security", "privilegios", "escalonamento de privilegios"] }
    ]
  },
  {
    "grupo": "Segurança Humana",
    "conceitos": [
      { "id": "HS01", "nome": "Social Engineering", "peso": 5, "tokens": ["engenharia social", "social engineering", "phishing", "vishing", "smishing"] },
      { "id": "HS02", "nome": "Security Forensics", "peso": 4, "tokens": ["forense digital", "computação forense", "cadeia de custodia", "investigação digital"] },
      { "id": "HS03", "nome": "Awareness", "peso": 2, "tokens": ["conscientização", "treinamento de segurança", "fator humano", "comportamento seguro"] }
    ]
  },
  {
    "grupo": "Segurança Organizacional",
    "conceitos": [
      { "id": "OR01", "nome": "Security Frameworks", "peso": 5, "tokens": ["iso 27001", "iso 27002", "nist csf", "cobit", "itil security"] },
      { "id": "OR02", "nome": "Risk Management", "peso": 4, "tokens": ["gestao de riscos", "risk management", "analise de riscos", "iso 27005"] },
      { "id": "OR03", "nome": "Audit & Compliance", "peso": 3, "tokens": ["auditoria de segurança", "conformidade", "compliance", "normas de segurança"] },
      { "id": "OR04", "nome": "Security Policy", "peso": 2, "tokens": ["psic", "politica de seguranca", "governança de ti"] }
    ]
  },
  {
    "grupo": "Segurança Social",
    "conceitos": [
      { "id": "SC01", "nome": "Cyber Law", "peso": 5, "tokens": ["lgpd", "gdpr", "marco civil da internet", "lei carolina dieckmann", "direito digital"] },
      { "id": "SC02", "nome": "Digital Ethics", "peso": 4, "tokens": ["etica hacker", "etica computacional", "privacidade digital"] },
      { "id": "SC03", "nome": "Cybercrime", "peso": 2, "tokens": ["cibercrime", "crimes ciberneticos", "propriedade intelectual"] }
    ]
  }
];

/**
 * Interface que representa uma ocorrência encontrada no texto.
 */
export interface Match {
  id: string;          // ID único da ocorrência
  conceptId: string;   // ID do conceito
  conceptName: string; // Nome do conceito
  group: string;       // Grupo ao qual pertence
  weight: number;      // Peso do conceito
  token: string;       // Termo exato encontrado
  snippet: string;     // Trecho de contexto (snippet)
  isIgnored: boolean;  // Define se é um Falso Positivo
}

/**
 * Interface que representa o resultado final de uma análise de curso.
 */
export interface AnalysisResult {
  id: string;
  ies: string;
  curso: string;
  ano: string;
  campus: string;
  pais: string;
  tipo: 'Pública (Federal)' | 'Pública (Estadual)' | 'Pública (Municipal)' | 'Privada (Sem fins lucrativos)' | 'Privada (Com fins lucrativos)';
  nivel: 'Bacharelado' | 'Licenciatura' | 'Tecnólogo' | 'Especialização' | 'MBA (Master in Business Administration)' | 'Técnico Integrado' | 'Técnico Concomitante' | 'Técnico Subsequente';
  modalidade: 'EAD (Educação a Distância)' | 'Presencial' | 'Híbrido (Semipresencial)';
  matches: Match[];
  score: number;       // Score Final (IIS)
  classification: 'Crítico' | 'Parcial' | 'Adequado' | 'Excelente';
  groupScores: Record<string, number>; // Scores individuais por grupo
  timestamp: number;   // Data da análise
}
