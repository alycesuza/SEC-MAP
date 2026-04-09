import { FirestoreErrorInfo } from '../firebase';

export function getFriendlyErrorMessage(error: any): string {
  let message = 'Ocorreu um erro inesperado.';
  
  if (error instanceof Error) {
    try {
      // Tenta parsear se for o erro JSON do Firestore
      const errorInfo: FirestoreErrorInfo = JSON.parse(error.message);
      
      if (errorInfo.error.includes('Missing or insufficient permissions')) {
        return 'Você não tem permissão para realizar esta ação. Verifique se seu acesso foi aprovado.';
      }
      
      if (errorInfo.error.includes('quota exceeded')) {
        return 'Limite de uso do banco de dados excedido. Tente novamente amanhã.';
      }

      if (errorInfo.error.includes('offline')) {
        return 'Você parece estar offline. Verifique sua conexão.';
      }

      message = `Erro na operação ${errorInfo.operationType}: ${errorInfo.error}`;
    } catch {
      // Se não for JSON, usa a mensagem direta
      message = error.message;
    }
  } else if (typeof error === 'string') {
    message = error;
  }

  // Traduções comuns de erros do Firebase Auth
  if (message.includes('auth/user-disabled')) return 'Esta conta foi desativada.';
  if (message.includes('auth/operation-not-allowed')) return 'Operação não permitida.';
  if (message.includes('auth/popup-closed-by-user')) return 'O login foi cancelado.';
  if (message.includes('auth/network-request-failed')) return 'Erro de rede ao tentar fazer login.';

  return message;
}
