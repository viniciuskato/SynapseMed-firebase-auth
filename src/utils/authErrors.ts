/**
 * Utilitário de Tradução de Erros do Firebase Authentication para Português
 */

export function getFirebaseAuthErrorMessage(error: any): string {
  if (!error) return 'Ocorreu um erro desconhecido.';

  const code = typeof error === 'string' ? error : error?.code || '';

  switch (code) {
    case 'auth/email-already-in-use':
      return 'Este endereço de e-mail já está cadastrado no SynapseMed. Faça login com sua senha ou utilize a recuperação de senha.';
    case 'auth/invalid-email':
      return 'O formato do e-mail informado é inválido. Verifique se digitou corretamente (ex: estudante@faculdade.edu.br).';
    case 'auth/user-not-found':
      return 'Não encontramos nenhuma conta cadastrada com este endereço de e-mail. Verifique a digitação ou crie uma nova conta.';
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
      return 'E-mail ou senha incorretos. Por favor, confira suas credenciais de acesso.';
    case 'auth/weak-password':
      return 'A senha é muito fraca. Escolha uma senha com no mínimo 6 caracteres, preferencialmente combinando letras e números.';
    case 'auth/missing-password':
      return 'Por favor, informe sua senha de acesso.';
    case 'auth/missing-email':
      return 'Por favor, informe o seu endereço de e-mail.';
    case 'auth/too-many-requests':
      return 'Acesso temporariamente bloqueado devido a muitas tentativas sem sucesso. Por segurança, aguarde alguns instantes antes de tentar novamente.';
    case 'auth/user-disabled':
      return 'Esta conta de usuário foi desativada pelo administrador. Entre em contato com o suporte acadêmico.';
    case 'auth/popup-closed-by-user':
      return 'A janela de autenticação com o Google foi fechada antes de concluir o processo.';
    case 'auth/cancelled-popup-request':
      return 'A solicitação de login com o Google foi cancelada.';
    case 'auth/popup-blocked':
      return 'O navegador bloqueou a janela pop-up do Google. Permita pop-ups para este site e tente novamente.';
    case 'auth/network-request-failed':
      return 'Falha de conexão com os servidores de autenticação. Verifique sua conexão com a internet e tente novamente.';
    case 'auth/operation-not-allowed':
      return 'O método de autenticação por e-mail e senha não está habilitado no Firebase Console do projeto. Ative o provedor "Email/Password" no console do Firebase.';
    case 'auth/requires-recent-login':
      return 'Esta operação requer autenticação recente. Por favor, encerre a sessão e entre novamente.';
    default: {
      const msg = error?.message;
      if (typeof msg === 'string' && msg.trim().length > 0 && !msg.startsWith('Firebase:')) {
        return msg;
      }
      return 'Ocorreu um erro ao processar sua autenticação. Por favor, tente novamente.';
    }
  }
}
