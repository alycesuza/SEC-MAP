/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart3, 
  Upload, 
  LayoutDashboard, 
  FileText, 
  FileCode,
  Search, 
  Trash2, 
  Download, 
  AlertCircle, 
  CheckCircle2, 
  ChevronRight, 
  ChevronDown,
  XCircle,
  Database,
  Info,
  Users,
  Monitor,
  RefreshCcw,
  Edit,
  X,
  Sun,
  Moon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Chart as ChartJS, 
  RadialLinearScale, 
  PointElement, 
  LineElement, 
  Filler, 
  Tooltip, 
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  Title
} from 'chart.js';
import { Radar, Bar } from 'react-chartjs-2';

import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  onAuthStateChanged, 
  User, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  where, 
  doc, 
  updateDoc, 
  deleteDoc, 
  orderBy,
  setDoc,
  getDoc,
  limit,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { auth, db, loginWithGoogle, logout, handleFirestoreError, OperationType } from './firebase';

import { DICTIONARY, AnalysisResult, Match } from './constants';
import { extractTextFromPDF, mineConcepts, calculateIIS } from './miningEngine';
import { cn, normalizeText } from './lib/utils';
import { getFriendlyErrorMessage } from './lib/errorUtils';

ChartJS.register(
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  Title
);

import { RadarChartScientific } from './components/dashboard/RadarChartScientific';
import { CurricularHeatmap } from './components/dashboard/CurricularHeatmap';
import { DistributionChart } from './components/dashboard/DistributionChart';
import { MaturityStackedBar } from './components/dashboard/MaturityStackedBar';
import { ScientificRankingTable } from './components/dashboard/ScientificRankingTable';

type Tab = 'dashboard' | 'analysis' | 'results' | 'about' | 'logs' | 'users';

interface AuditLogEntry {
  id: string;
  userId?: string;
  userEmail?: string;
  action: string;
  details: string;
  timestamp: number;
}

interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  role: 'admin' | 'editor' | 'user';
  isApproved: boolean;
  createdAt: any;
}

export default function App() {
  // --- ESTADOS DA APLICAÇÃO ---
  const [activeTab, setActiveTab] = useState<Tab>('about'); // Aba ativa na navegação (Inicia no Sobre)
  const [results, setResults] = useState<AnalysisResult[]>([]); // Lista de todas as análises realizadas
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);         // Logs de auditoria
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);   // Lista de usuários (Admin)
  const [isAnalyzing, setIsAnalyzing] = useState(false);        // Status de carregamento da análise
  const [progress, setProgress] = useState(0);                   // Progresso da extração do PDF (0-100)
  const [error, setError] = useState<string | null>(null);       // Mensagens de erro
  const [globalError, setGlobalError] = useState<string | null>(null); // Erros globais (toasts)
  const [searchTerm, setSearchTerm] = useState('');              // Termo de busca na aba de resultados
  const [userSearchTerm, setUserSearchTerm] = useState('');      // Termo de busca na aba de usuários
  const [expandedId, setExpandedId] = useState<string | null>(null); // ID do card de resultado expandido
  const [selectedFile, setSelectedFile] = useState<File | null>(null); // Arquivo PDF selecionado
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });
  const [editModal, setEditModal] = useState<{
    isOpen: boolean;
    result: AnalysisResult | null;
  }>({ isOpen: false, result: null });

  const [reasonModal, setReasonModal] = useState<{
    isOpen: boolean;
    resultId: string;
    matchId: string;
    reason: string;
  }>({ isOpen: false, resultId: '', matchId: '', reason: '' });

  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [maturityFilter, setMaturityFilter] = useState<string | null>(null);

  // --- ESTADOS DO FIREBASE ---
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('theme') as 'dark' | 'light') || 'dark';
    }
    return 'dark';
  });

  // --- EFEITOS DE TEMA ---
  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  // --- ESTADO DO FORMULÁRIO DE CADASTRO ---
  const [formData, setFormData] = useState({
    ies: '',
    curso: '',
    ano: '',
    campus: '',
    pais: 'Brasil',
    tipo: 'Pública (Federal)' as 'Pública (Federal)' | 'Pública (Estadual)' | 'Pública (Municipal)' | 'Privada (Sem fins lucrativos)' | 'Privada (Com fins lucrativos)',
    nivel: 'Bacharelado' as 'Bacharelado' | 'Licenciatura' | 'Tecnólogo' | 'Especialização' | 'MBA (Master in Business Administration)' | 'Técnico Integrado' | 'Técnico Concomitante' | 'Técnico Subsequente',
    modalidade: 'Presencial' as 'EAD (Educação a Distância)' | 'Presencial' | 'Híbrido (Semipresencial)'
  });

  // Efeito para limpar erro global após 5 segundos
  useEffect(() => {
    if (globalError) {
      const timer = setTimeout(() => setGlobalError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [globalError]);

  // --- PERSISTÊNCIA (Firebase) ---
  const logAction = React.useCallback(async (action: string, details: string) => {
    if (!auth.currentUser) return;
    try {
      await addDoc(collection(db, 'logs'), {
        userId: auth.currentUser.uid,
        userEmail: auth.currentUser.email,
        action,
        details,
        timestamp: Date.now()
      });
    } catch (err) {
      console.error('Failed to log action', err);
    }
  }, []);

  // 1. Gerencia Estado de Autenticação
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      
      if (!currentUser) {
        setUserProfile(null);
        setIsAuthReady(true);
      }
    });
    return () => unsubscribe();
  }, []);

  // 2. Log de entrada e Redirecionamento
  useEffect(() => {
    if (user) {
      logAction('Login', `Usuário ${user.email} entrou no sistema.`);
    }
  }, [user?.uid, logAction]);

  useEffect(() => {
    if (!user && (activeTab === 'analysis' || activeTab === 'logs' || activeTab === 'users')) {
      setActiveTab('about');
    }
  }, [user?.uid, activeTab]);

  // 3. Gerencia Perfil do Usuário Logado
  useEffect(() => {
    if (!user?.uid) return;

    const userRef = doc(db, 'users', user.uid);
    const unsubscribe = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as UserProfile;
        
        // Auto-reparo para a administradora principal
        if (user.email === 'alycesuza@gmail.com' && (data.role !== 'admin' || !data.isApproved)) {
          console.log("Restaurando privilégios da administradora principal...");
          updateDoc(userRef, { role: 'admin', isApproved: true })
            .catch(err => console.error("Erro ao auto-reparar admin:", err));
        }

        // Só atualiza se houver mudança real para evitar re-renders infinitos
        setUserProfile(prev => JSON.stringify(prev) === JSON.stringify(data) ? prev : data);
      } else {
        // Primeiro login: Criar perfil pendente
        const isAdmin = user.email === 'alycesuza@gmail.com';
        const newProfile: UserProfile = {
          uid: user.uid,
          email: user.email || '',
          displayName: user.displayName || 'Usuário',
          photoURL: user.photoURL || '',
          role: isAdmin ? 'admin' : 'user',
          isApproved: isAdmin,
          createdAt: serverTimestamp()
        };
        setDoc(userRef, newProfile).catch(err => handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`));
      }
      setIsAuthReady(true);
    }, (err) => {
      console.error("Erro ao carregar perfil:", err);
      setIsAuthReady(true);
    });

    return () => unsubscribe();
  }, [user?.uid, user?.email]);

  // Escuta mudanças nos resultados (Público)
  useEffect(() => {
    const q = query(
      collection(db, 'mappings'),
      orderBy('timestamp', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as AnalysisResult[];
      setResults(data);
    }, (err) => {
      setGlobalError(getFriendlyErrorMessage(err));
      handleFirestoreError(err, OperationType.LIST, 'mappings');
    });

    return () => unsubscribe();
  }, []);

  // Escuta mudanças nos logs (Apenas aprovados)
  useEffect(() => {
    const isApproved = userProfile?.isApproved;
    const uid = user?.uid;

    if (!uid || !isApproved) {
      setLogs([]);
      return;
    }

    const q = query(
      collection(db, 'logs'),
      orderBy('timestamp', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as AuditLogEntry[];
      setLogs(data);
    }, (err) => {
      setGlobalError(getFriendlyErrorMessage(err));
      handleFirestoreError(err, OperationType.LIST, 'logs');
    });

    return () => unsubscribe();
  }, [user?.uid, userProfile?.isApproved]);

  // Escuta lista de usuários (Admin e Editor)
  useEffect(() => {
    const role = userProfile?.role;
    const uid = user?.uid;

    if (!uid || (role !== 'admin' && role !== 'editor')) {
      setAllUsers([]);
      return;
    }

    const q = query(
      collection(db, 'users'),
      orderBy('createdAt', 'desc'),
      limit(50) // Limita para evitar travamentos se houver muitos usuários
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        ...doc.data(),
        uid: doc.id
      })) as unknown as UserProfile[];
      setAllUsers(data);
    }, (err) => {
      setGlobalError(getFriendlyErrorMessage(err));
      handleFirestoreError(err, OperationType.LIST, 'users');
    });

    return () => unsubscribe();
  }, [user?.uid, userProfile?.role]);

  /**
   * Gerencia a seleção do arquivo PDF.
   */
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setError(null);
  };

  /**
   * Inicia o processo de análise: Extração -> Mineração -> Cálculo de Score.
   */
  const startAnalysis = async () => {
    if (!selectedFile) {
      setError('Por favor, selecione um arquivo PDF.');
      return;
    }

    if (!formData.ies || !formData.curso || !formData.ano) {
      setError('Por favor, preencha IES, Curso e Ano antes de analisar.');
      return;
    }

    // Verifica se já existe uma análise para a mesma IES/Curso/Ano para evitar duplicatas acidentais
    const exists = results.find(r => 
      r.ies.toLowerCase() === formData.ies.toLowerCase() && 
      r.curso.toLowerCase() === formData.curso.toLowerCase() && 
      r.ano === formData.ano
    );

    if (exists) {
      setConfirmModal({
        isOpen: true,
        title: 'Sobrescrever Análise',
        message: 'Este curso já foi analisado. Deseja sobrescrever os resultados?',
        onConfirm: async () => {
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
          try {
            await deleteDoc(doc(db, 'mappings', exists.id));
            continueAnalysis();
          } catch (err) {
            setGlobalError(getFriendlyErrorMessage(err));
            handleFirestoreError(err, OperationType.DELETE, `mappings/${exists.id}`);
          }
        }
      });
      return;
    }

    continueAnalysis();
  };

  const continueAnalysis = async () => {
    if (!user) return;

    setIsAnalyzing(true);
    setProgress(0);
    setError(null);

    try {
      // 1. Extrai o texto bruto do PDF
      const text = await extractTextFromPDF(selectedFile, setProgress);
      // 2. Procura pelos termos do dicionário no texto
      const matches = mineConcepts(text);
      // 3. Calcula o Índice de Inclusão de Segurança (IIS)
      const { score, groupScores, classification } = calculateIIS(matches);

      // 4. Cria o objeto de resultado final
      const newResult = {
        userId: user.uid,
        ...formData,
        matches,
        score,
        groupScores,
        classification,
        manualAdjustments: {},
        timestamp: Date.now()
      };

      // Salva no Firestore
      const docRef = await addDoc(collection(db, 'mappings'), newResult);
      
      await logAction('Nova Análise', `Mapeamento criado para ${formData.curso} - ${formData.ies}`);
      
      // Navega para os resultados
      setActiveTab('results');
      setExpandedId(docRef.id);
      
      // Reseta o formulário para a próxima análise
      setFormData({
        ies: '',
        curso: '',
        ano: '',
        campus: '',
        pais: 'Brasil',
        tipo: 'Pública (Federal)',
        nivel: 'Bacharelado',
        modalidade: 'Presencial'
      });
      setSelectedFile(null);
    } catch (err: any) {
      setError(getFriendlyErrorMessage(err));
    } finally {
      setIsAnalyzing(false);
    }
  };

  /**
   * Alterna o status de "Ignorado" (Falso Positivo) de um termo encontrado.
   * Dispara automaticamente o recálculo do score do curso.
   */
  const toggleIgnoreMatch = async (resultId: string, matchId: string) => {
    const res = results.find(r => r.id === resultId);
    if (!res) return;

    const updatedMatches = res.matches.map(m => {
      if (m.id === matchId) {
        return { ...m, isIgnored: !m.isIgnored };
      }
      return m;
    });

    const { score, groupScores, classification } = calculateIIS(updatedMatches, res.manualAdjustments || {});
    
    try {
      const docRef = doc(db, 'mappings', resultId);
      await updateDoc(docRef, {
        matches: updatedMatches,
        score,
        groupScores,
        classification
      });
      
      const match = updatedMatches.find(m => m.id === matchId);
      await logAction('Alteração de Falso Positivo', `${match?.isIgnored ? 'Ignorado' : 'Restaurado'} termo "${match?.token}" em ${res.curso}`);
    } catch (err) {
      setGlobalError(getFriendlyErrorMessage(err));
      handleFirestoreError(err, OperationType.UPDATE, `mappings/${resultId}`);
    }
  };

  const updateMatchReason = async (resultId: string, matchId: string, reason: string) => {
    const res = results.find(r => r.id === resultId);
    if (!res) return;

    const updatedMatches = res.matches.map(m => {
      if (m.id === matchId) {
        return { ...m, reason };
      }
      return m;
    });

    try {
      const docRef = doc(db, 'mappings', resultId);
      await updateDoc(docRef, { matches: updatedMatches });
      setReasonModal(prev => ({ ...prev, isOpen: false }));
    } catch (err) {
      setGlobalError(getFriendlyErrorMessage(err));
      handleFirestoreError(err, OperationType.UPDATE, `mappings/${resultId}`);
    }
  };

  const updateManualAdjustment = async (resultId: string, group: string, value: number) => {
    const res = results.find(r => r.id === resultId);
    if (!res) return;

    const manualAdjustments = { ...res.manualAdjustments, [group]: value };
    const { score, groupScores, classification } = calculateIIS(res.matches, manualAdjustments);

    try {
      const docRef = doc(db, 'mappings', resultId);
      await updateDoc(docRef, {
        manualAdjustments,
        score,
        groupScores,
        classification
      });
      await logAction('Ajuste de Pontuação', `Ajuste manual de ${value} pontos no grupo ${group} em ${res.curso}`);
    } catch (err) {
      setGlobalError(getFriendlyErrorMessage(err));
      handleFirestoreError(err, OperationType.UPDATE, `mappings/${resultId}`);
    }
  };

  const updateResultMetadata = async (id: string, metadata: Partial<AnalysisResult>) => {
    try {
      const docRef = doc(db, 'mappings', id);
      await updateDoc(docRef, metadata);
      await logAction('Edição de Metadados', `Alterou dados de ${metadata.curso || 'análise'}`);
      setEditModal({ isOpen: false, result: null });
    } catch (err) {
      setGlobalError(getFriendlyErrorMessage(err));
      handleFirestoreError(err, OperationType.UPDATE, `mappings/${id}`);
    }
  };

  /**
   * Exclui uma análise específica da lista.
   */
  const deleteResult = async (id: string) => {
    const res = results.find(r => r.id === id);
    setConfirmModal({
      isOpen: true,
      title: 'Excluir Análise',
      message: 'Excluir esta análise permanentemente?',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        try {
          await deleteDoc(doc(db, 'mappings', id));
          await logAction('Exclusão de Análise', `Mapeamento de ${res?.curso} removido.`);
        } catch (err) {
          setGlobalError(getFriendlyErrorMessage(err));
          handleFirestoreError(err, OperationType.DELETE, `mappings/${id}`);
        }
      }
    });
  };

  /**
   * Gerencia aprovação de usuários (Admin).
   */
  const toggleUserApproval = async (userId: string, currentStatus: boolean) => {
    const targetUser = allUsers.find(u => u.uid === userId);
    if (targetUser?.email === 'alycesuza@gmail.com') {
      setGlobalError('Não é possível alterar o status da administradora principal.');
      return;
    }
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, { isApproved: !currentStatus });
      await logAction('Gestão de Usuário', `${!currentStatus ? 'Aprovou' : 'Revogou'} acesso de ${targetUser?.email}`);
    } catch (err) {
      setGlobalError(getFriendlyErrorMessage(err));
      handleFirestoreError(err, OperationType.UPDATE, `users/${userId}`);
    }
  };

  const changeUserRole = async (userId: string, newRole: 'admin' | 'editor' | 'user') => {
    const targetUser = allUsers.find(u => u.uid === userId);
    if (targetUser?.email === 'alycesuza@gmail.com') {
      setGlobalError('Não é possível alterar o cargo da administradora principal.');
      return;
    }
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, { role: newRole });
      await logAction('Gestão de Usuário', `Alterou cargo de ${targetUser?.email} para ${newRole}`);
    } catch (err) {
      setGlobalError(getFriendlyErrorMessage(err));
      handleFirestoreError(err, OperationType.UPDATE, `users/${userId}`);
    }
  };

  /**
   * Função para destacar visualmente o termo encontrado dentro do trecho de texto.
   */
  const highlightToken = (snippet: string, token: string) => {
    if (!token) return snippet;
    const normalizedToken = normalizeText(token);
    const escapedToken = normalizedToken.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const parts = snippet.split(new RegExp(`(${escapedToken})`, 'gi'));
    
    return parts.map((part, i) => 
      part.toLowerCase() === normalizedToken.toLowerCase() 
        ? <strong key={i} className="text-orange-500 font-black not-italic">{part}</strong> 
        : part
    );
  };

  /**
   * Limpa todo o banco de dados local.
   */
  const clearDatabase = async () => {
    setConfirmModal({
      isOpen: true,
      title: 'LIMPAR BANCO DE DADOS',
      message: 'LIMPAR TODO O BANCO DE DADOS? Esta ação não pode ser desfeita.',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        try {
          const promises = results.map(r => deleteDoc(doc(db, 'mappings', r.id)));
          await Promise.all(promises);
          await logAction('Sistema', 'Limpeza total do banco de dados realizada');
        } catch (err) {
          setGlobalError(getFriendlyErrorMessage(err));
          handleFirestoreError(err, OperationType.DELETE, 'mappings/all');
        }
      }
    });
  };

  /**
   * Exporta os dados de todas as análises em formato CSV (Planilha).
   */
  const exportCSV = () => {
    if (results.length === 0) return;

    const headers = [
      'ID', 'IES', 'Curso', 'País', 'Nível', 'Modalidade', 'Ano', 'Campus', 'Tipo', 'Score Final', 'Classificação',
      ...DICTIONARY.map(g => g.grupo),
      'Palavras_Detectadas',
      'Data_Analise'
    ];

    const rows = results.map(r => {
      // Agrupa palavras únicas detectadas (não ignoradas)
      const detectedWords = Array.from(new Set(r.matches.filter(m => !m.isIgnored).map(m => m.token))).join('; ');
      return [
        r.id, r.ies, r.curso, r.pais, r.nivel, r.modalidade, r.ano, r.campus, r.tipo, r.score, r.classification,
        ...DICTIONARY.map(g => r.groupScores[g.grupo] || 0),
        detectedWords,
        new Date(r.timestamp).toISOString()
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(val => `"${val}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `sec-map-export-${Date.now()}.csv`;
    link.click();
  };

  /**
   * Exporta os dados em formato Markdown (Relatório formatado).
   */
  const exportMarkdown = () => {
    if (results.length === 0) return;

    let mdContent = `# Relatório de mapeamento de PPCs (Sec-Map)\n\n`;
    mdContent += `Data de Exportação: ${new Date().toLocaleString()}\n\n`;

    results.forEach((r, idx) => {
      const detectedWords = Array.from(new Set(r.matches.filter(m => !m.isIgnored).map(m => m.token))).join(', ');
      
      mdContent += `## ${idx + 1}. ${r.curso} - ${r.ies}\n\n`;
      mdContent += `**Metadados:**\n`;
      mdContent += `- **País:** ${r.pais}\n`;
      mdContent += `- **Ano:** ${r.ano}\n`;
      mdContent += `- **Campus:** ${r.campus}\n`;
      mdContent += `- **Tipo:** ${r.tipo}\n`;
      mdContent += `- **Nível:** ${r.nivel}\n`;
      mdContent += `- **Modalidade:** ${r.modalidade}\n\n`;
      
      mdContent += `**Resultados:**\n`;
      mdContent += `- **Score Final (IIS):** ${r.score}\n`;
      mdContent += `- **Classificação:** ${r.classification}\n\n`;
      
      mdContent += `**Pontuação por Grupo:**\n`;
      DICTIONARY.forEach(g => {
        mdContent += `- **${g.grupo}:** ${r.groupScores[g.grupo] || 0}/15\n`;
      });
      
      mdContent += `\n**Palavras-chave Detectadas:**\n`;
      mdContent += `${detectedWords || '_Nenhuma palavra detectada_'}\n\n`;
      mdContent += `---\n\n`;
    });

    const blob = new Blob([mdContent], { type: 'text/markdown;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `sec-map-export-${Date.now()}.md`;
    link.click();
  };

  /**
   * Filtra os resultados com base no termo de busca (IES ou Curso).
   */
  const filteredResults = useMemo(() => {
    let filtered = results.filter(r => 
      r.ies.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.curso.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (maturityFilter) {
      filtered = filtered.filter(r => r.classification === maturityFilter);
    }

    return filtered;
  }, [results, searchTerm, maturityFilter]);

  const stats = useMemo(() => {
    if (results.length === 0) return null;
    const avg = results.reduce((acc, r) => acc + r.score, 0) / results.length;
    const counts = {
      Excelente: results.filter(r => r.classification === 'Excelente').length,
      Adequado: results.filter(r => r.classification === 'Adequado').length,
      Parcial: results.filter(r => r.classification === 'Parcial').length,
      Crítico: results.filter(r => r.classification === 'Crítico').length,
    };
    const countries = new Set(results.map(r => r.pais.trim().toLowerCase())).size;
    return { avg, counts, countries };
  }, [results]);

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-zinc-500 font-medium animate-pulse">Carregando Sec-Map...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans selection:bg-orange-500/30">
      {/* Header */}
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-600 rounded-lg flex items-center justify-center shadow-lg shadow-orange-900/20">
              <Database className="text-white" size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Sec-Map</h1>
              <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold">mapeamento de PPCs</p>
            </div>
          </div>

          <nav className="flex gap-1 bg-zinc-200/50 dark:bg-zinc-800/50 p-1 rounded-xl">
            {(['about', 'results', 'dashboard'] as Tab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 capitalize",
                  activeTab === tab 
                    ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm" 
                    : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-white/50 dark:hover:bg-zinc-800"
                )}
              >
                {tab === 'dashboard' && <BarChart3 className="inline-block mr-2" size={16} />}
                {tab === 'results' && <FileText className="inline-block mr-2" size={16} />}
                {tab === 'about' && <Info className="inline-block mr-2" size={16} />}
                {tab === 'about' ? 'Sobre' : tab === 'results' ? 'Resultados' : 'Dashboard'}
              </button>
            ))}
            
            {user && (userProfile?.isApproved || user.email === 'alycesuza@gmail.com') && (['analysis', 'logs'] as Tab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 capitalize",
                  activeTab === tab 
                    ? "bg-orange-600 text-white shadow-sm" 
                    : "text-orange-500/70 hover:text-orange-400 hover:bg-orange-500/10"
                )}
              >
                {tab === 'analysis' && <Upload className="inline-block mr-2" size={16} />}
                {tab === 'logs' && <FileCode className="inline-block mr-2" size={16} />}
                {tab === 'analysis' ? 'Analysis' : 'Audit Log'}
              </button>
            ))}

            {userProfile && (userProfile.role === 'admin' || userProfile.role === 'editor' || user.email === 'alycesuza@gmail.com') && (
              <button
                onClick={() => setActiveTab('users')}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 capitalize",
                  activeTab === 'users' 
                    ? "bg-zinc-700 text-white shadow-sm" 
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
                )}
              >
                <Users className="inline-block mr-2" size={16} />
                Usuários
              </button>
            )}
          </nav>

          <div className="flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-3">
                <div className="hidden md:block text-right">
                  <p className="text-xs font-bold text-zinc-100">{user.displayName}</p>
                  <p className="text-[10px] text-zinc-500">{user.email}</p>
                </div>
                <img 
                  src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`} 
                  alt={user.displayName || 'User'} 
                  className="w-8 h-8 rounded-full border border-zinc-700"
                  referrerPolicy="no-referrer"
                />
                <button 
                  onClick={logout}
                  className="p-2 text-zinc-400 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-colors"
                  title="Sair"
                >
                  <XCircle size={20} />
                </button>
              </div>
            ) : (
              <button 
                onClick={loginWithGoogle}
                className="flex items-center gap-2 px-4 py-2 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white rounded-xl text-sm font-bold transition-all"
              >
                <Users size={18} />
                login
              </button>
            )}

            <div className="h-6 w-px bg-zinc-200 dark:bg-zinc-800 mx-1 hidden md:block" />

            <button 
              onClick={toggleTheme}
              className="p-2 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg transition-colors"
              title={theme === 'dark' ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
            >
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>

            <div className="h-6 w-px bg-zinc-200 dark:bg-zinc-800 mx-1 hidden md:block" />

            {user && userProfile?.isApproved && (
              <div className="flex items-center gap-3">
                 <button 
                  onClick={exportCSV}
                  disabled={results.length === 0}
                  className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors disabled:opacity-30"
                  title="Exportar CSV"
                >
                  <Download size={20} />
                </button>
                <button 
                  onClick={exportMarkdown}
                  disabled={results.length === 0}
                  className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors disabled:opacity-30"
                  title="Exportar Markdown"
                >
                  <FileCode size={20} />
                </button>
                <button 
                  onClick={clearDatabase}
                  disabled={results.length === 0}
                  className="p-2 text-zinc-400 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-30"
                  title="Limpar Banco"
                >
                  <Trash2 size={20} />
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl shadow-sm">
                  <p className="text-zinc-500 text-xs uppercase tracking-wider font-bold mb-1">Total de Cursos</p>
                  <h3 className="text-4xl font-black">{results.length}</h3>
                </div>
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl shadow-sm">
                  <p className="text-zinc-500 text-xs uppercase tracking-wider font-bold mb-1">Média de IIS</p>
                  <h3 className="text-4xl font-black text-orange-500">
                    {stats ? stats.avg.toFixed(1) : '0.0'}
                  </h3>
                </div>
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl shadow-sm">
                  <p className="text-zinc-500 text-xs uppercase tracking-wider font-bold mb-1">Países</p>
                  <h3 className="text-4xl font-black text-blue-500">
                    {stats ? stats.countries : '0'}
                  </h3>
                </div>
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl lg:col-span-2 flex items-center justify-between shadow-sm">
                  <div className="space-y-1">
                    <p className="text-zinc-500 text-xs uppercase tracking-wider font-bold">Distribuição de Maturidade</p>
                    <div className="flex gap-4 mt-2">
                      {stats && Object.entries(stats.counts).map(([label, count]) => (
                        <div key={label} className="text-center">
                          <p className="text-[10px] text-zinc-500 uppercase">{label}</p>
                          <p className="font-bold">{count}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <BarChart3 className="text-zinc-200 dark:text-zinc-700" size={48} />
                </div>
              </div>

              {results.length > 0 ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-8 rounded-3xl shadow-sm">
                    <h4 className="text-lg font-bold mb-6 flex items-center gap-2">
                      <BarChart3 size={20} className="text-orange-500" />
                      Média por domínio
                    </h4>
                    <div className="h-[300px]">
                      <Bar 
                        data={{
                          labels: DICTIONARY.map(g => g.grupo.replace('Segurança de ', '').replace('Segurança ', '')),
                          datasets: [{
                            label: 'Média de Pontos',
                            data: DICTIONARY.map(g => {
                              const sum = results.reduce((acc, r) => acc + (r.groupScores[g.grupo] || 0), 0);
                              return sum / results.length;
                            }),
                            backgroundColor: 'rgba(249, 115, 22, 0.6)',
                            borderColor: '#f97316',
                            borderWidth: 1,
                            borderRadius: 4
                          }]
                        }}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          scales: {
                            y: { beginAtZero: true, max: 15, grid: { color: '#27272a' } },
                            x: { grid: { display: false } }
                          },
                          plugins: { legend: { display: false } }
                        }}
                      />
                    </div>
                  </div>

                  <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-8 rounded-3xl shadow-sm">
                    <h4 className="text-lg font-bold mb-6 flex items-center gap-2">
                      <LayoutDashboard size={20} className="text-orange-500" />
                      Top 5 cursos (IIS)
                    </h4>
                    <div className="space-y-4">
                      {([...results].sort((a, b) => b.score - a.score).slice(0, 5)).map((r, idx) => (
                        <div key={r.id} className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-800/30 rounded-xl border border-zinc-100 dark:border-zinc-800">
                          <div className="flex items-center gap-4">
                            <span className="text-zinc-600 font-mono text-sm">0{idx + 1}</span>
                            <div>
                              <p className="font-bold text-sm">{r.curso}</p>
                              <p className="text-xs text-zinc-500">{r.ies} • {r.ano}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xl font-black text-orange-500">{r.score}</p>
                            <p className="text-[10px] uppercase font-bold text-zinc-600">{r.classification}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Novos Componentes Científicos */}
                  <div className="lg:col-span-2 space-y-8">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      <RadarChartScientific 
                        results={results} 
                        selectedResult={results.find(r => r.id === selectedCourseId) || null}
                        isLoggedIn={!!user}
                      />
                      <MaturityStackedBar 
                        results={results} 
                        onFilter={(classification) => {
                          setMaturityFilter(classification === maturityFilter ? null : classification);
                          // Rolar para a tabela se necessário
                        }}
                        isLoggedIn={!!user}
                      />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      <DistributionChart results={results} isLoggedIn={!!user} />
                      <CurricularHeatmap results={results} isLoggedIn={!!user} />
                    </div>

                    <div className="space-y-4">
                      {maturityFilter && (
                        <div className="flex items-center justify-between bg-orange-500/10 border border-orange-500/20 p-4 rounded-2xl">
                          <p className="text-sm text-orange-500 font-medium">
                            Filtrando por maturidade: <span className="font-bold uppercase">{maturityFilter}</span>
                          </p>
                          <button 
                            onClick={() => setMaturityFilter(null)}
                            className="text-xs text-orange-500 hover:underline font-bold"
                          >
                            Limpar Filtro
                          </button>
                        </div>
                      )}
                      <ScientificRankingTable 
                        results={filteredResults} 
                        onSelect={setSelectedCourseId}
                        selectedId={selectedCourseId}
                        isLoggedIn={!!user}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-96 flex flex-col items-center justify-center border-2 border-dashed border-zinc-800 rounded-3xl text-zinc-500">
                  <Info size={48} className="mb-4 opacity-20" />
                  <p>Nenhum dado disponível. Comece uma nova análise.</p>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'analysis' && user && (
            <motion.div 
              key="analysis"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="max-w-3xl mx-auto"
            >
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl overflow-hidden shadow-2xl">
                <div className="p-8 border-b border-zinc-200 dark:border-zinc-800">
                  <h2 className="text-2xl font-bold mb-2">Nova Mineração</h2>
                  <p className="text-zinc-500 dark:text-zinc-400 text-sm">Preencha os metadados do curso e faça o upload do PPC em PDF.</p>
                </div>

                <div className="p-8 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase text-zinc-500 tracking-wider">Instituição (IES)</label>
                      <input 
                        type="text" 
                        value={formData.ies}
                        onChange={e => setFormData({...formData, ies: e.target.value})}
                        placeholder="Ex: UFSC, USP, PUC..."
                        className="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase text-zinc-500 tracking-wider">Curso</label>
                      <input 
                        type="text" 
                        value={formData.curso}
                        onChange={e => setFormData({...formData, curso: e.target.value})}
                        placeholder="Ex: Ciência da Computação"
                        className="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase text-zinc-500 tracking-wider">Nível do Curso</label>
                      <select 
                        value={formData.nivel}
                        onChange={e => setFormData({...formData, nivel: e.target.value as any})}
                        className="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all appearance-none"
                      >
                        <option value="Bacharelado">Bacharelado</option>
                        <option value="Licenciatura">Licenciatura</option>
                        <option value="Tecnólogo">Tecnólogo</option>
                        <option value="Especialização">Especialização</option>
                        <option value="MBA (Master in Business Administration)">MBA (Master in Business Administration)</option>
                        <option value="Técnico Integrado">Técnico Integrado</option>
                        <option value="Técnico Concomitante">Técnico Concomitante</option>
                        <option value="Técnico Subsequente">Técnico Subsequente</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase text-zinc-500 tracking-wider">Ano do PPC</label>
                      <input 
                        type="text" 
                        value={formData.ano}
                        onChange={e => setFormData({...formData, ano: e.target.value})}
                        placeholder="Ex: 2023"
                        className="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase text-zinc-500 tracking-wider">Campus / Local</label>
                      <input 
                        type="text" 
                        value={formData.campus}
                        onChange={e => setFormData({...formData, campus: e.target.value})}
                        placeholder="Ex: São Paulo"
                        className="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase text-zinc-500 tracking-wider">País</label>
                      <input 
                        type="text" 
                        value={formData.pais}
                        onChange={e => setFormData({...formData, pais: e.target.value})}
                        placeholder="Ex: Brasil"
                        className="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-zinc-500 tracking-wider">Modalidade</label>
                    <div className="flex flex-wrap gap-3">
                      {[
                        { label: 'Presencial', value: 'Presencial', icon: Users },
                        { label: 'EAD', value: 'EAD (Educação a Distância)', icon: Monitor },
                        { label: 'Híbrido', value: 'Híbrido (Semipresencial)', icon: RefreshCcw }
                      ].map(m => (
                        <button
                          key={m.value}
                          type="button"
                          onClick={() => setFormData({...formData, modalidade: m.value as any})}
                          className={cn(
                            "flex-1 py-3 px-2 rounded-xl border transition-all font-medium text-xs flex flex-col items-center gap-2",
                            formData.modalidade === m.value 
                              ? "bg-orange-600 border-orange-500 text-white" 
                              : "bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:border-orange-500/50"
                          )}
                        >
                          <m.icon size={16} />
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase text-zinc-500 tracking-wider">Tipo de IES (Pública)</label>
                      <div className="flex flex-wrap gap-3">
                        {['Pública (Federal)', 'Pública (Estadual)', 'Pública (Municipal)'].map(t => (
                          <button
                            key={t}
                            onClick={() => setFormData({...formData, tipo: t as any})}
                            className={cn(
                              "flex-1 py-3 px-2 rounded-xl border transition-all font-medium text-xs whitespace-nowrap",
                              formData.tipo === t 
                                ? "bg-orange-600 border-orange-500 text-white" 
                                : "bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:border-orange-500/50"
                            )}
                          >
                            {t.replace('Pública (', '').replace(')', '')}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase text-zinc-500 tracking-wider">Tipo de IES (Privada)</label>
                      <div className="flex flex-wrap gap-3">
                        {['Privada (Sem fins lucrativos)', 'Privada (Com fins lucrativos)'].map(t => (
                          <button
                            key={t}
                            onClick={() => setFormData({...formData, tipo: t as any})}
                            className={cn(
                              "flex-1 py-3 px-2 rounded-xl border transition-all font-medium text-xs whitespace-nowrap",
                              formData.tipo === t 
                                ? "bg-orange-600 border-orange-500 text-white" 
                                : "bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:border-orange-500/50"
                            )}
                          >
                            {t.replace('Privada (', '').replace(')', '')}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 space-y-4">
                    <div 
                      className={cn(
                        "relative border-2 border-dashed rounded-3xl p-12 flex flex-col items-center justify-center transition-all",
                        isAnalyzing ? "border-orange-500 bg-orange-500/5" : "border-zinc-700 hover:border-zinc-500 bg-zinc-800/30",
                        selectedFile && !isAnalyzing && "border-green-500/50 bg-green-500/5"
                      )}
                    >
                      {isAnalyzing ? (
                        <div className="text-center space-y-4 w-full max-w-xs">
                          <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
                            <motion.div 
                              className="bg-orange-500 h-full"
                              initial={{ width: 0 }}
                              animate={{ width: `${progress}%` }}
                            />
                          </div>
                          <p className="text-sm font-bold text-orange-500 animate-pulse">Minerando Conceitos... {progress}%</p>
                        </div>
                      ) : (
                        <>
                          {selectedFile ? (
                            <div className="text-center">
                              <CheckCircle2 size={48} className="text-green-500 mb-4 mx-auto" />
                              <p className="text-lg font-bold mb-1">{selectedFile.name}</p>
                              <p className="text-zinc-500 text-sm mb-6">Arquivo selecionado com sucesso</p>
                              <button 
                                onClick={() => setSelectedFile(null)}
                                className="text-xs text-zinc-500 hover:text-zinc-300 underline"
                              >
                                Alterar arquivo
                              </button>
                            </div>
                          ) : (
                            <>
                              <Upload size={48} className="text-zinc-600 mb-4" />
                              <p className="text-lg font-bold mb-1">Arraste o PDF aqui</p>
                              <p className="text-zinc-500 text-sm mb-6">Ou clique para selecionar o arquivo</p>
                              <input 
                                type="file" 
                                accept="application/pdf"
                                onChange={handleFileUpload}
                                className="absolute inset-0 opacity-0 cursor-pointer"
                              />
                              <div className="px-4 py-2 bg-zinc-700 rounded-lg text-xs font-bold uppercase tracking-wider">Selecionar PPC</div>
                            </>
                          )}
                        </>
                      )}
                    </div>

                    <button
                      onClick={startAnalysis}
                      disabled={!selectedFile || isAnalyzing}
                      className={cn(
                        "w-full py-4 rounded-2xl font-black uppercase tracking-widest transition-all shadow-lg",
                        (!selectedFile || isAnalyzing)
                          ? "bg-zinc-800 text-zinc-600 cursor-not-allowed"
                          : "bg-orange-600 text-white hover:bg-orange-500 shadow-orange-900/20"
                      )}
                    >
                      {isAnalyzing ? "Analisando..." : "Enviar para Análise"}
                    </button>
                  </div>

                  {error && (
                    <div className="bg-red-900/20 border border-red-900/50 p-4 rounded-xl flex items-start gap-3 text-red-200 text-sm">
                      <AlertCircle size={18} className="shrink-0 mt-0.5" />
                      <p>{error}</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'results' && (
            <motion.div 
              key="results"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                <div className="relative w-full md:w-96">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                  <input 
                    type="text" 
                    placeholder="Buscar IES ou Curso..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl pl-12 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                  />
                </div>
                <p className="text-zinc-500 text-sm font-medium">
                  Mostrando {filteredResults.length} de {results.length} análises
                </p>
              </div>

              <div className="space-y-4">
                {filteredResults.map(res => (
                  <div key={res.id} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl overflow-hidden shadow-sm">
                    <div 
                      className="p-6 flex items-center justify-between cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors"
                      onClick={() => setExpandedId(expandedId === res.id ? null : res.id)}
                    >
                      <div className="flex items-center gap-6">
                        <div className={cn(
                          "w-16 h-16 rounded-2xl flex flex-col items-center justify-center font-black text-2xl",
                          res.classification === 'Excelente' ? "bg-green-500/20 text-green-500" :
                          res.classification === 'Adequado' ? "bg-blue-500/20 text-blue-500" :
                          res.classification === 'Parcial' ? "bg-orange-500/20 text-orange-500" :
                          "bg-red-500/20 text-red-500"
                        )}>
                          {res.score}
                        </div>
                        <div>
                          <h3 className="text-xl font-bold">{res.curso}</h3>
                          <p className="text-zinc-500 text-sm">{res.ies} • {res.pais} • {res.nivel} • {res.modalidade} • {res.campus} • {res.ano} • {res.tipo}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right hidden md:block">
                          <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Maturidade</p>
                          <p className={cn(
                            "font-black uppercase",
                            res.classification === 'Excelente' ? "text-green-500" :
                            res.classification === 'Adequado' ? "text-blue-500" :
                            res.classification === 'Parcial' ? "text-orange-500" :
                            "text-red-500"
                          )}>{res.classification}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {user && (user.uid === res.userId || userProfile?.role === 'admin' || user.email === 'alycesuza@gmail.com') && (
                            <button 
                              onClick={(e) => { e.stopPropagation(); setEditModal({ isOpen: true, result: res }); }}
                              className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-all"
                              title="Editar Metadados"
                            >
                              <Edit size={16} />
                            </button>
                          )}
                          {user && (userProfile?.isApproved || user.email === 'alycesuza@gmail.com') && (user.uid === res.userId || userProfile?.role === 'admin' || user.email === 'alycesuza@gmail.com') && (
                            <button 
                              onClick={(e) => { e.stopPropagation(); deleteResult(res.id); }}
                              className="p-2 text-zinc-600 hover:text-red-500 hover:bg-red-900/20 rounded-lg transition-all"
                            >
                              <Trash2 size={20} />
                            </button>
                          )}
                        </div>
                        {expandedId === res.id ? <ChevronDown size={24} /> : <ChevronRight size={24} />}
                      </div>
                    </div>

                    <AnimatePresence>
                      {expandedId === res.id && (
                        <motion.div 
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="border-t border-zinc-800"
                        >
                          <div className="p-8 grid grid-cols-1 lg:grid-cols-3 gap-12">
                            {/* Radar Chart */}
                            <div className="space-y-6">
                              <h4 className="text-sm font-bold uppercase tracking-widest text-zinc-500">Equilíbrio CSEC2017</h4>
                              <div className="aspect-square bg-zinc-800/20 p-4 rounded-3xl border border-zinc-800">
                                <Radar 
                                  data={{
                                    labels: DICTIONARY.map(g => g.grupo.replace('Segurança de ', '').replace('Segurança ', '')),
                                    datasets: [{
                                      label: 'Pontuação',
                                      data: DICTIONARY.map(g => res.groupScores[g.grupo] || 0),
                                      backgroundColor: 'rgba(249, 115, 22, 0.2)',
                                      borderColor: '#f97316',
                                      borderWidth: 2,
                                      pointBackgroundColor: '#f97316',
                                    }]
                                  }}
                                  options={{
                                    scales: {
                                      r: {
                                        min: 0,
                                        max: 15,
                                        ticks: { display: false, stepSize: 5 },
                                        grid: { color: '#27272a' },
                                        angleLines: { color: '#27272a' },
                                        pointLabels: { color: '#71717a', font: { size: 10, weight: 'bold' } }
                                      }
                                    },
                                    plugins: { legend: { display: false } }
                                  }}
                                />
                              </div>
                              <div className="flex items-center gap-2">
                                <h4 className="text-sm font-bold uppercase tracking-widest text-zinc-500">Pontuação por Grupo</h4>
                                <span className="text-[10px] text-zinc-600 italic">(Máx. 15 pts/grupo)</span>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {DICTIONARY.map(g => (
                                  <div key={g.grupo} className="flex flex-col p-4 bg-zinc-50 dark:bg-zinc-950/50 rounded-2xl border border-zinc-100 dark:border-zinc-800/50">
                                    <div className="flex items-center justify-between mb-2">
                                      <span className="text-zinc-500 font-bold uppercase text-[10px]">{g.grupo.replace('Segurança de ', '').replace('Segurança ', '')}</span>
                                      <span className="font-black text-orange-500">{res.groupScores[g.grupo] || 0}/15</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <label className="text-[9px] text-zinc-600 uppercase font-bold">Ajuste:</label>
                                      <input 
                                        type="number"
                                        value={res.manualAdjustments?.[g.grupo] || 0}
                                        onChange={(e) => updateManualAdjustment(res.id, g.grupo, parseInt(e.target.value) || 0)}
                                        disabled={!user || (user.uid !== res.userId && userProfile?.role !== 'admin' && user.email !== 'alycesuza@gmail.com')}
                                        className={cn(
                                          "w-12 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded px-1 py-0.5 text-[10px] focus:outline-none focus:border-orange-500/50",
                                          (!user || (user.uid !== res.userId && userProfile?.role !== 'admin' && user.email !== 'alycesuza@gmail.com')) && "opacity-50 cursor-not-allowed"
                                        )}
                                      />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Traceability Panel */}
                            <div className="lg:col-span-2 space-y-6">
                              <div className="flex items-center justify-between">
                                <h4 className="text-sm font-bold uppercase tracking-widest text-zinc-500">Rastreabilidade de Conceitos</h4>
                                <span className="text-xs bg-zinc-100 dark:bg-zinc-800 px-3 py-1 rounded-full font-mono">
                                  {res.matches.filter(m => !m.isIgnored).length} achados válidos
                                </span>
                              </div>
                              
                              <div className="space-y-3 max-h-[800px] overflow-y-auto pr-2 custom-scrollbar">
                                {res.matches.map((m, idx) => (
                                  <div 
                                    key={`${m.conceptId}-${idx}`} 
                                    className={cn(
                                      "p-4 rounded-2xl border transition-all",
                                      m.isIgnored 
                                        ? "bg-zinc-100/50 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 opacity-40 grayscale" 
                                        : "bg-zinc-50 dark:bg-zinc-800/30 border-zinc-100 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700"
                                    )}
                                  >
                                    <div className="flex items-start justify-between mb-3">
                                      <div>
                                        <div className="flex items-center gap-2 mb-1">
                                          <span className="text-[10px] font-bold uppercase px-2 py-0.5 bg-zinc-200 dark:bg-zinc-700 rounded text-zinc-600 dark:text-zinc-300">
                                            {m.group}
                                          </span>
                                          <span className="text-[10px] font-bold uppercase px-2 py-0.5 bg-orange-500/20 text-orange-500 rounded">
                                            Peso {m.weight}
                                          </span>
                                        </div>
                                        <h5 className="font-bold text-zinc-900 dark:text-zinc-100">{m.conceptName}</h5>
                                        <p className="text-xs text-zinc-500">Termo: <span className="text-orange-400 font-mono">"{m.token}"</span></p>
                                      </div>
                                      {user && (userProfile?.isApproved || user.email === 'alycesuza@gmail.com') && (
                                        <div className="flex flex-col gap-2">
                                          <button 
                                            onClick={() => toggleIgnoreMatch(res.id, m.id)}
                                            className={cn(
                                              "flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all",
                                              m.isIgnored 
                                                ? "bg-green-500/10 text-green-500 hover:bg-green-500/20" 
                                                : "bg-red-500/10 text-red-500 hover:bg-red-500/20"
                                            )}
                                          >
                                            {m.isIgnored ? (
                                              <><CheckCircle2 size={12} /> Reconsiderar</>
                                            ) : (
                                              <><XCircle size={12} /> Falso Positivo</>
                                            )}
                                          </button>
                                          {m.isIgnored && (
                                            <button 
                                              onClick={() => setReasonModal({ isOpen: true, resultId: res.id, matchId: m.id, reason: m.reason || '' })}
                                              className="text-[9px] text-zinc-500 hover:text-zinc-300 underline text-left"
                                            >
                                              {m.reason ? 'Editar Justificativa' : 'Adicionar Justificativa'}
                                            </button>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                    {m.reason && (
                                      <div className="mt-2 text-[10px] text-orange-500/70 italic bg-orange-500/5 p-2 rounded-lg border border-orange-500/10">
                                        <strong>Justificativa:</strong> {m.reason}
                                      </div>
                                    )}
                                    <div className="bg-zinc-100 dark:bg-zinc-950/50 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800/50">
                                      <p className="text-xs font-mono text-zinc-600 dark:text-zinc-400 leading-relaxed italic">
                                        {highlightToken(m.snippet, m.token)}
                                      </p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}

                {filteredResults.length === 0 && (
                  <div className="py-20 text-center text-zinc-500">
                    <Search size={48} className="mx-auto mb-4 opacity-10" />
                    <p>Nenhuma análise encontrada para sua busca.</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'users' && userProfile && (userProfile.role === 'admin' || userProfile.role === 'editor' || user.email === 'alycesuza@gmail.com') && (
            <motion.div 
              key="users"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-8 shadow-sm">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-8">
                  <div>
                    <h2 className="text-2xl font-bold">Gestão de Usuários</h2>
                    <p className="text-zinc-500 text-sm">
                      {userProfile.role === 'admin' 
                        ? 'Aprove ou revogue o acesso de pesquisadores ao sistema.' 
                        : 'Visualize e gerencie cargos de pesquisadores.'}
                    </p>
                  </div>
                  <div className="relative w-full md:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                    <input 
                      type="text" 
                      placeholder="Buscar usuário..."
                      value={userSearchTerm}
                      onChange={(e) => setUserSearchTerm(e.target.value)}
                      className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {allUsers
                    .filter(u => 
                      u.displayName.toLowerCase().includes(userSearchTerm.toLowerCase()) || 
                      u.email.toLowerCase().includes(userSearchTerm.toLowerCase())
                    )
                    .map(u => (
                    <div key={u.uid} className="bg-zinc-50 dark:bg-zinc-800/30 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl space-y-4 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors shadow-sm">
                      <div className="flex items-center gap-4">
                        <img src={u.photoURL} alt="" className="w-12 h-12 rounded-full border border-zinc-200 dark:border-zinc-700" referrerPolicy="no-referrer" />
                        <div className="min-w-0">
                          <h4 className="font-bold text-zinc-900 dark:text-zinc-100 truncate">{u.displayName}</h4>
                          <p className="text-xs text-zinc-500 truncate">{u.email}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between pt-2">
                        <span className={cn(
                          "text-[10px] font-black uppercase px-2 py-1 rounded",
                          u.isApproved ? "bg-green-500/20 text-green-500" : "bg-red-500/20 text-red-500"
                        )}>
                          {u.isApproved ? 'Aprovado' : 'Pendente'}
                        </span>
                        <span className="text-[10px] font-black uppercase px-2 py-1 bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 rounded">
                          {u.role}
                        </span>
                      </div>

                      <div className="flex gap-2 pt-2">
                        <button 
                          onClick={() => toggleUserApproval(u.uid, u.isApproved)}
                          disabled={userProfile.role !== 'admin' || u.email === 'alycesuza@gmail.com'}
                          className={cn(
                            "flex-1 py-2 rounded-xl text-xs font-bold transition-all",
                            u.isApproved ? "bg-red-500/10 text-red-500 hover:bg-red-500/20" : "bg-green-500/10 text-green-500 hover:bg-green-500/20",
                            (userProfile.role !== 'admin' || u.email === 'alycesuza@gmail.com') && "opacity-50 cursor-not-allowed grayscale"
                          )}
                        >
                          {u.isApproved ? 'Revogar' : 'Aprovar'}
                        </button>
                        <button 
                          onClick={() => {
                            const roles: ('admin' | 'editor' | 'user')[] = ['user', 'editor', 'admin'];
                            const nextRole = roles[(roles.indexOf(u.role) + 1) % roles.length];
                            changeUserRole(u.uid, nextRole);
                          }}
                          disabled={u.email === 'alycesuza@gmail.com'}
                          className={cn(
                            "px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-xl text-xs font-bold transition-all",
                            u.email === 'alycesuza@gmail.com' && "opacity-50 cursor-not-allowed"
                          )}
                        >
                          Mudar Cargo
                        </button>
                      </div>
                      {userProfile.role === 'editor' && (
                        <p className="text-[10px] text-zinc-500 text-center italic">
                          Editores não podem alterar o status de aprovação.
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'logs' && user && (userProfile?.isApproved || user.email === 'alycesuza@gmail.com') && (
            <motion.div 
              key="logs"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-8 shadow-sm">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">Painel de Auditoria</h2>
                    <p className="text-zinc-500 text-sm">Registro de acessos e modificações no sistema.</p>
                  </div>
                  <div className="bg-orange-600/10 text-orange-500 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest border border-orange-500/20">
                    {logs.length} Eventos Registrados
                  </div>
                </div>

                <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                  {logs.map((log) => (
                    <div key={log.id} className="bg-zinc-50 dark:bg-zinc-800/30 border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl flex items-start gap-4 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all">
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                        log.action === 'Login' ? "bg-blue-500/20 text-blue-500" :
                        log.action === 'Nova Análise' ? "bg-green-500/20 text-green-500" :
                        log.action === 'Exclusão de Análise' ? "bg-red-500/20 text-red-500" :
                        "bg-orange-500/20 text-orange-500"
                      )}>
                        {log.action === 'Login' ? <Users size={20} /> :
                         log.action === 'Nova Análise' ? <Upload size={20} /> :
                         log.action === 'Exclusão de Análise' ? <Trash2 size={20} /> :
                         <RefreshCcw size={20} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="font-bold text-zinc-900 dark:text-zinc-100">{log.action}</h4>
                          <span className="text-[10px] font-mono text-zinc-500">
                            {new Date(log.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-2">{log.details}</p>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] bg-zinc-100 dark:bg-zinc-900 px-2 py-0.5 rounded text-zinc-500 font-mono">
                            UID: {log.userId?.slice(0, 8)}...
                          </span>
                          <span className="text-[10px] bg-zinc-100 dark:bg-zinc-900 px-2 py-0.5 rounded text-zinc-500 font-mono">
                            {log.userEmail}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {logs.length === 0 && (
                    <div className="py-20 text-center text-zinc-500">
                      <FileCode size={48} className="mx-auto mb-4 opacity-10" />
                      <p>Nenhum log registrado ainda.</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {user && !userProfile?.isApproved && user.email !== 'alycesuza@gmail.com' && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-md mx-auto py-20 text-center space-y-6"
            >
              <div className="w-20 h-20 bg-orange-500/10 text-orange-500 rounded-full flex items-center justify-center mx-auto">
                <RefreshCcw size={40} className="animate-spin-slow" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">Solicitação Enviada</h2>
                <p className="text-zinc-600 dark:text-zinc-400">Seu pedido de acesso foi registrado com sucesso. Agora, aguarde a aprovação de um administrador.</p>
              </div>
              <div className="p-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-sm text-zinc-600 dark:text-zinc-500">
                Você receberá acesso às ferramentas de análise e auditoria assim que sua solicitação for validada.
              </div>
              <button 
                onClick={logout}
                className="text-zinc-500 hover:text-white underline text-sm"
              >
                Cancelar solicitação / Sair
              </button>
            </motion.div>
          )}

          {activeTab === 'about' && (
            <motion.div 
              key="about"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
                  <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-8 md:p-12 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-orange-600/10 blur-3xl rounded-full -mr-32 -mt-32" />
                    
                    <div className="relative z-10 max-w-4xl">
                      <h2 className="text-4xl font-bold mb-2 tracking-tight">Sobre o Sec-Map</h2>
                      <p className="text-orange-500 font-medium mb-6 flex items-center gap-2">
                        Desenvolvido por: Alyce Silva e Wanessa Borba
                      </p>
                      <p className="text-zinc-600 dark:text-zinc-400 text-lg leading-relaxed mb-12">
                        O Sec-Map (Ferramenta de mapeamento de PPCs de Educação em Segurança) é uma plataforma desenvolvida para analisar e minerar conceitos de cibersegurança em Projetos Pedagógicos de Curso (PPCs). 
                        Utilizando o framework global <strong>CSEC2017</strong> como base, a ferramenta oferece uma análise determinística e rastreável da maturidade do ensino de segurança, com suporte nativo para termos em <strong>Português e Inglês</strong>.
                      </p>

                  <div className="space-y-12 mt-12">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                      <section className="space-y-3">
                        <h3 className="text-xl font-bold text-orange-500 flex items-center gap-2">
                          <CheckCircle2 size={20} />
                          1. Detecção binária bilíngue
                        </h3>
                        <p className="text-zinc-600 dark:text-zinc-400 text-sm leading-relaxed">
                          Evitamos punir ementas curtas ou premiar ementas prolixas. O sistema não conta a frequência, mas sim a <strong>presença</strong> do conceito. 
                          A base de dados abrange termos em <strong>Português e Inglês</strong> (ex: <i>"Secure Coding"</i> e <i>"Programação Segura"</i>), unificando-os no mesmo ID de conceito.
                        </p>
                      </section>

                      <section className="space-y-3">
                        <h3 className="text-xl font-bold text-orange-500 flex items-center gap-2">
                          <Database size={20} />
                          2. Ponderação por custo (w)
                        </h3>
                        <p className="text-zinc-600 dark:text-zinc-400 text-sm leading-relaxed">
                          Cada conceito tem um peso <strong>w (1 a 5)</strong> baseado no "Custo de Inclusão Curricular". 
                          Pesos maiores (5) exigem mudanças estruturais (ex: Labs), enquanto pesos menores (1) são termos mais genéricos.
                        </p>
                      </section>
                    </div>

                    {/* Camada de Revisão Humana */}
                    <section className="space-y-4 bg-orange-500/5 border border-orange-500/20 rounded-2xl p-6">
                      <h3 className="text-xl font-bold text-orange-500 flex items-center gap-2">
                        <Search size={20} />
                        3. O conceito de falso positivo
                      </h3>
                      <p className="text-zinc-600 dark:text-zinc-400 text-sm leading-relaxed">
                        A mineração de texto automática pode identificar termos que, embora presentes no documento, não representam uma competência de segurança no contexto específico (ex: a palavra "segurança" em "segurança do trabalho"). 
                      </p>
                      <p className="text-zinc-600 dark:text-zinc-400 text-sm leading-relaxed">
                        O Sec-Map permite que o pesquisador revise cada ocorrência na aba de <strong>Resultados</strong>. Ao marcar um termo como <strong>Falso Positivo</strong>, ele é ignorado no cálculo do IIS, garantindo que o score final reflita apenas o conteúdo pedagógico real de cibersegurança.
                      </p>
                    </section>

                    {/* Camada 4 */}
                    <section className="space-y-4">
                      <h3 className="text-xl font-bold text-orange-500 flex items-center gap-2">
                        <BarChart3 size={20} />
                        4. Camada de teto categórico
                      </h3>
                      <p className="text-zinc-600 dark:text-zinc-400 text-sm leading-relaxed">
                        Esta é a parte mais importante para a sua pesquisa. Nós dividimos o dicionário em 8 domínios. Para cada domínio <i>i</i>, calculamos a soma dos pesos dos conceitos encontrados (<i>S<sub>i</sub></i>). No entanto, aplicamos um <strong>Teto (T) de 15 pontos</strong>.
                      </p>
                      
                      <div className="flex justify-center py-8 bg-zinc-50 dark:bg-zinc-800/20 rounded-2xl border border-zinc-100 dark:border-zinc-800/50">
                        <div className="text-2xl md:text-3xl font-serif italic text-zinc-900 dark:text-zinc-100 flex items-center gap-2 tracking-wide">
                          S<sub>i</sub> = min 
                          <span className="text-4xl font-light mx-1 text-zinc-400 dark:text-zinc-500">(</span>
                          15, Σ (w<sub>conceito</sub> × presença)
                          <span className="text-4xl font-light mx-1 text-zinc-400 dark:text-zinc-500">)</span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <h4 className="font-bold text-zinc-800 dark:text-zinc-200 text-sm">Por que o Teto de 15?</h4>
                        <p className="text-zinc-500 text-sm leading-relaxed italic">
                          Se um curso for "obsessivo" em Criptografia e tiver 10 termos de peso 5, a soma seria 50. Sem o teto, esse curso pareceria "Adequado" mesmo sem ensinar mais nada. Com o teto, ele ganha apenas 15 pontos. Para subir a nota global, ele é <strong>obrigado</strong> a ter conceitos em outros domínios (Redes, Software, Humano, etc.).
                        </p>
                      </div>
                    </section>

                    {/* Camada 5 */}
                    <section className="space-y-4">
                      <h3 className="text-xl font-bold text-orange-500 flex items-center gap-2">
                        <LayoutDashboard size={20} />
                        5. Camada de normalização final (O score IIS)
                      </h3>
                      <p className="text-zinc-400 text-sm leading-relaxed">
                        O <strong>Índice de Integração de Segurança (IIS)</strong> final é a soma dos resultados dos 8 domínios, normalizada por um <strong>Score Ideal (S<sub>ideal</sub>)</strong> de 75 pontos.
                      </p>

                      <div className="flex justify-center py-10 bg-zinc-50 dark:bg-zinc-800/20 rounded-2xl border border-zinc-100 dark:border-zinc-800/50">
                        <div className="text-2xl md:text-3xl font-serif italic text-zinc-900 dark:text-zinc-100 flex items-center gap-2 tracking-wide">
                          IIS = min 
                          <span className="text-5xl font-light mx-1 text-zinc-400 dark:text-zinc-500">(</span>
                          100, 
                          <div className="flex flex-col items-center mx-3">
                            <span className="border-b border-zinc-400 dark:border-zinc-500 px-4 pb-1">Σ<sub>i=1</sub><sup>8</sup> S<sub>i</sub></span>
                            <span className="pt-1">75</span>
                          </div>
                          × 100
                          <span className="text-5xl font-light mx-1 text-zinc-400 dark:text-zinc-500">)</span>
                        </div>
                      </div>

                      <ul className="list-disc list-inside space-y-2 text-sm text-zinc-500 italic">
                        <li>
                          <strong className="text-zinc-300 not-italic">O divisor 75:</strong> Representa que o curso atingiu aproximadamente 62% da cobertura total teórica (120 pontos). Na estatística educacional, isso é o marco da proficiência. Se o curso ultrapassar 75, ele é considerado "fora da curva" e sua nota é travada em 100.
                        </li>
                      </ul>
                    </section>
                  </div>

                  <div className="mt-16 bg-zinc-50 dark:bg-zinc-800/30 border border-zinc-100 dark:border-zinc-800 rounded-2xl p-6">
                    <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                      <AlertCircle size={20} className="text-orange-500" />
                      Classificação por maturidade
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="border-b border-zinc-200 dark:border-zinc-700 text-zinc-500">
                            <th className="pb-3 font-semibold">Faixa de Score</th>
                            <th className="pb-3 font-semibold">Classificação</th>
                            <th className="pb-3 font-semibold">Nível de Maturidade</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                          <tr>
                            <td className="py-4 font-mono">0 - 24</td>
                            <td className="py-4"><span className="px-2 py-1 bg-red-900/30 text-red-400 rounded-md text-xs font-bold">🔴 Crítico</span></td>
                            <td className="py-4 text-zinc-600 dark:text-zinc-400">Inexistente: Menções acidentais e superficiais.</td>
                          </tr>
                          <tr>
                            <td className="py-4 font-mono">25 - 49</td>
                            <td className="py-4"><span className="px-2 py-1 bg-orange-900/30 text-orange-400 rounded-md text-xs font-bold">🟠 Parcial</span></td>
                            <td className="py-4 text-zinc-400">Fragmentado: Presença de fundamentos, mas sem Software.</td>
                          </tr>
                          <tr>
                            <td className="py-4 font-mono">50 - 74</td>
                            <td className="py-4"><span className="px-2 py-1 bg-blue-900/30 text-blue-400 rounded-md text-xs font-bold">🟡 Adequado</span></td>
                            <td className="py-4 text-zinc-400">Definido: Cobertura sólida e intencional dos pilares principais.</td>
                          </tr>
                          <tr>
                            <td className="py-4 font-mono">75 - 100</td>
                            <td className="py-4"><span className="px-2 py-1 bg-green-900/30 text-green-400 rounded-md text-xs font-bold">🟢 Excelente</span></td>
                            <td className="py-4 text-zinc-400">Otimizado: Alinhamento total com padrões globais (ACM/IEEE).</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="flex items-center justify-between px-4">
                  <h2 className="text-2xl font-bold">Dicionário de conceitos</h2>
                  <span className="text-xs bg-zinc-800 text-zinc-400 px-3 py-1 rounded-full border border-zinc-700">Base CSEC2017</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {DICTIONARY.map((group) => (
                    <div key={group.grupo} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors shadow-sm">
                      <h3 className="text-orange-500 font-bold mb-4 text-sm uppercase tracking-wider">{group.grupo}</h3>
                      <div className="space-y-3">
                        {group.conceitos.map((c) => (
                          <div key={c.id} className="group">
                            <div className="flex justify-between items-start mb-1">
                              <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-200">{c.nome}</span>
                              <span className="text-[10px] bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-500">P{c.peso}</span>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {c.tokens.slice(0, 6).map(t => (
                                <span key={t} className="text-[9px] text-zinc-500 italic border-b border-zinc-100 dark:border-zinc-800">"{t}"</span>
                              ))}
                              {c.tokens.length > 6 && <span className="text-[9px] text-zinc-600">+{c.tokens.length - 6}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-center">
                <p className="text-zinc-500 text-sm">
                  Desenvolvido para fins de pesquisa científica e análise de currículos acadêmicos. 
                  <br />
                  Baseado no <strong>Cybersecurity Curricula 2017 (CSEC2017)</strong> da ACM/IEEE/AIS/IFIP.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="max-w-7xl mx-auto px-4 py-12 border-t border-zinc-900 text-center">
        <p className="text-zinc-600 text-xs font-medium uppercase tracking-widest">
          Sec-Map © 2026 • Pesquisa Científica em Educação em Segurança
        </p>
      </footer>

      {/* Global Error Toast */}
      <AnimatePresence>
        {globalError && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] w-full max-w-md px-4"
          >
            <div className="bg-red-900 border border-red-800 p-4 rounded-2xl shadow-2xl flex items-center gap-4">
              <AlertCircle className="text-red-200 shrink-0" size={24} />
              <p className="text-red-100 text-sm font-medium flex-1">{globalError}</p>
              <button 
                onClick={() => setGlobalError(null)}
                className="text-red-400 hover:text-red-200"
              >
                <XCircle size={20} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal de Edição de Metadados */}
      <AnimatePresence>
        {editModal.isOpen && editModal.result && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Editar Metadados</h3>
                <button onClick={() => setEditModal({ isOpen: false, result: null })} className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white">
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-zinc-500">IES</label>
                  <input 
                    type="text" 
                    defaultValue={editModal.result.ies}
                    id="edit-ies"
                    className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50 text-zinc-900 dark:text-zinc-100"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-zinc-500">Curso</label>
                  <input 
                    type="text" 
                    defaultValue={editModal.result.curso}
                    id="edit-curso"
                    className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50 text-zinc-900 dark:text-zinc-100"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-zinc-500">Ano</label>
                  <input 
                    type="text" 
                    defaultValue={editModal.result.ano}
                    id="edit-ano"
                    className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50 text-zinc-900 dark:text-zinc-100"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-zinc-500">Campus</label>
                  <input 
                    type="text" 
                    defaultValue={editModal.result.campus}
                    id="edit-campus"
                    className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50 text-zinc-900 dark:text-zinc-100"
                  />
                </div>
              </div>
              <div className="p-6 bg-zinc-50 dark:bg-zinc-950/50 flex justify-end gap-3">
                <button 
                  onClick={() => setEditModal({ isOpen: false, result: null })}
                  className="px-6 py-2 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white text-sm font-bold"
                >
                  Cancelar
                </button>
                <button 
                  onClick={() => {
                    const ies = (document.getElementById('edit-ies') as HTMLInputElement).value;
                    const curso = (document.getElementById('edit-curso') as HTMLInputElement).value;
                    const ano = (document.getElementById('edit-ano') as HTMLInputElement).value;
                    const campus = (document.getElementById('edit-campus') as HTMLInputElement).value;
                    updateResultMetadata(editModal.result!.id, { ies, curso, ano, campus });
                  }}
                  className="px-6 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-sm font-bold transition-all"
                >
                  Salvar Alterações
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal de Justificativa */}
      <AnimatePresence>
        {reasonModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Justificar Falso Positivo</h3>
                <button onClick={() => setReasonModal(prev => ({ ...prev, isOpen: false }))} className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white">
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <p className="text-sm text-zinc-600 dark:text-zinc-400">Explique por que este termo foi marcado como falso positivo nesta análise.</p>
                <textarea 
                  value={reasonModal.reason}
                  onChange={(e) => setReasonModal(prev => ({ ...prev, reason: e.target.value }))}
                  className="w-full h-32 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50 resize-none text-zinc-900 dark:text-zinc-100"
                  placeholder="Ex: O termo aparece em um contexto bibliográfico ou em uma citação que não reflete o conteúdo do curso..."
                />
              </div>
              <div className="p-6 bg-zinc-50 dark:bg-zinc-950/50 flex justify-end gap-3">
                <button 
                  onClick={() => setReasonModal(prev => ({ ...prev, isOpen: false }))}
                  className="px-6 py-2 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white text-sm font-bold"
                >
                  Cancelar
                </button>
                <button 
                  onClick={() => updateMatchReason(reasonModal.resultId, reasonModal.matchId, reasonModal.reason)}
                  className="px-6 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-sm font-bold transition-all"
                >
                  Salvar Justificativa
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Custom Confirmation Modal */}
      <AnimatePresence>
        {confirmModal.isOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-8 rounded-3xl shadow-2xl w-full max-w-md"
            >
              <h3 className="text-xl font-bold mb-2 text-zinc-900 dark:text-zinc-100">{confirmModal.title}</h3>
              <p className="text-zinc-600 dark:text-zinc-400 mb-8">{confirmModal.message}</p>
              <div className="flex gap-4">
                <button 
                  onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                  className="flex-1 py-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 font-bold hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  onClick={confirmModal.onConfirm}
                  className="flex-1 py-3 rounded-xl bg-orange-600 text-white font-bold hover:bg-orange-500 transition-all"
                >
                  Confirmar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #27272a;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #3f3f46;
        }
      `}</style>
    </div>
  );
}
