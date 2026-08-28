import {
  requestPasswordResetOTP,
  verifyPasswordResetOTP,
  finalizePasswordReset,
  normalizeEmail,
} from '../../utils/passwordRecovery';
import React, { useState } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithPopup,
  GoogleAuthProvider,
  updateProfile,
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';
import { PwaInstallButton } from '../PWA/PwaInstallButton';
import { UserRole } from '../../types';
import {
  Map,
  Lock,
  Mail,
  User as UserIcon,
  Building2,
  Phone,
  Briefcase,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  KeyRound,
  ArrowLeft,
  FileText,
} from 'lucide-react';
import { LegalPoliciesModal } from '../Legal/LegalPoliciesModal';

export const LoginScreen: React.FC = () => {
  // Modes: 'login' | 'register' | 'forgot_password'
  const [viewMode, setViewMode] = useState<'login' | 'register' | 'forgot_password'>('login');
  const [isPoliciesOpen, setIsPoliciesOpen] = useState(false);

  // Form fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [company, setCompany] = useState('');
  const [phone, setPhone] = useState('');
  const [requestedRole, setRequestedRole] = useState<UserRole>('surveyor');
  const [showPassword, setShowPassword] = useState(false);

  // States for main auth
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [success, setSuccess] = useState('');

  // States for password recovery microform
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [resetError, setResetError] = useState('');

  // 1. Handle Email/Password Login & Register
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!email || !password) {
      setError('Por favor, preencha o e-mail e a senha.');
      return;
    }

    if (viewMode === 'register' && !name.trim()) {
      setError('Por favor, informe seu Nome Completo para identificação da equipe.');
      return;
    }

    setLoading(true);

    try {
      if (viewMode === 'login') {
        setSuccess('Autenticando... Preparando mapas e dados...');
        await signInWithEmailAndPassword(auth, email.trim(), password);
      } else if (viewMode === 'register') {
        const userCred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        const currentUser = userCred.user;

        // Update display name in Firebase Auth
        await updateProfile(currentUser, {
          displayName: name.trim(),
        });

        const isOwner = currentUser.email?.toLowerCase() === 'alexandre1604981@gmail.com';

        // Explicitly write profile to Firestore
        const userDocRef = doc(db, 'users', currentUser.uid);
        await setDoc(
          userDocRef,
          {
            uid: currentUser.uid,
            email: currentUser.email?.trim() || '',
            name: name.trim(),
            company: company.trim() || 'AM TST SAÚDE E SEGURANÇA DO TRABALHO',
            phone: phone.trim(),
            requestedRole: requestedRole,
            role: isOwner ? 'super_admin' : requestedRole,
            status: isOwner ? 'active' : 'pending',
            subscriptionPlan: 'free_trial',
            subscriptionStatus: isOwner ? 'active' : 'trial',
            subscriptionValue: isOwner ? 0 : 97,
            avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name.trim())}&background=0284c7&color=fff`,
            createdAt: new Date().toISOString(),
          },
          { merge: true }
        );

        setSuccess('Cadastro realizado! Sua solicitação foi enviada para liberação do Administrador.');
        await new Promise((resolve) => setTimeout(resolve, 1200));
      }
    } catch (err: any) {
      let errorMessage = err.message || 'Erro ao autenticar. Verifique suas credenciais.';

      if (err.code === 'auth/email-already-in-use') {
        errorMessage = 'Este e-mail já está cadastrado. Tente fazer login ou recuperar a senha.';
      } else if (err.code === 'auth/invalid-email') {
        errorMessage = 'O formato do e-mail é inválido.';
      } else if (err.code === 'auth/weak-password') {
        errorMessage = 'A senha é muito fraca. Digite pelo menos 6 caracteres.';
      } else if (
        err.code === 'auth/user-not-found' ||
        err.code === 'auth/wrong-password' ||
        err.code === 'auth/invalid-credential'
      ) {
        errorMessage = 'E-mail ou senha incorretos.';
      } else if (err.code === 'auth/operation-not-allowed') {
        errorMessage = 'O login por e-mail e senha não está habilitado no servidor.';
      }

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // 2. Handle Google One-Tap / Popup Login with Detailed Guidance
  const handleGoogleLogin = async () => {
    setError('');
    setSuccess('');
    setGoogleLoading(true);

    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      console.warn('Firebase Google Auth error:', err);
      let errorMsg = 'Não foi possível autenticar com o Google.';

      if (err.code === 'auth/popup-closed-by-user') {
        errorMsg = 'O login com o Google foi cancelado.';
      } else if (err.code === 'auth/popup-blocked') {
        errorMsg = 'A janela do Google foi bloqueada pelo navegador. Permita pop-ups no seu navegador.';
      } else if (err.code === 'auth/operation-not-allowed' || err.code === 'auth/admin-restricted-operation') {
        errorMsg =
          'O provedor Google precisa ser ativado no Firebase Console (Authentication > Sign-in method > Google).';
      } else if (err.code === 'auth/unauthorized-domain') {
        errorMsg =
          'Domínio não autorizado no Firebase. Adicione o domínio atual em Authentication > Settings > Authorized domains no Firebase Console.';
      } else if (err.code === 'auth/network-request-failed') {
        errorMsg = 'Falha de conexão com os servidores. Verifique sua internet.';
      } else if (err.message) {
        errorMsg = `Erro do Google Auth: ${err.message}`;
      }

      setError(errorMsg);
    } finally {
      setGoogleLoading(false);
    }
  };

  // 3. Handle Password Recovery Micro-Form
  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError('');
    setResetSuccess(false);

    const targetEmail = resetEmail.trim() || email.trim();
    if (!targetEmail) {
      setResetError('Por favor, digite o e-mail cadastrado no sistema.');
      return;
    }

    setResetLoading(true);

    try {
      await sendPasswordResetEmail(auth, targetEmail);
      setResetSuccess(true);
    } catch (err: any) {
      let msg = 'Não foi possível enviar o e-mail de recuperação.';
      if (err.code === 'auth/user-not-found') {
        msg = 'Nenhum usuário foi encontrado com este endereço de e-mail.';
      } else if (err.code === 'auth/invalid-email') {
        msg = 'O endereço de e-mail informado é inválido.';
      } else if (err.code === 'auth/too-many-requests') {
        msg = 'Muitas solicitações seguidas. Aguarde alguns minutos e tente novamente.';
      }
      setResetError(msg);
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-3 sm:p-6 relative overflow-x-hidden py-6 sm:py-10">
      {/* Background ambient glow */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-sky-900/20 blur-[120px]" />
        <div className="absolute top-[60%] -right-[10%] w-[40%] h-[50%] rounded-full bg-emerald-900/20 blur-[120px]" />
      </div>

      <div className="w-full max-w-md z-10 space-y-3 sm:space-y-4">
        {/* Brand Logo & Title (Compact for Mobile) */}
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-sky-500 to-emerald-500 flex items-center justify-center text-white shadow-xl mb-2">
            <Map className="w-6 h-6 sm:w-7 sm:h-7" />
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
            GoField <span className="text-sky-400">Pro</span>
          </h1>
          <p className="text-slate-400 mt-0.5 text-center text-[11px] sm:text-xs">
            Navegação GPS, Mapas PDF e Gestão de Campo
          </p>
        </div>

        {/* ======================================================== */}
        {/* VIEW 1: PASSWORD RECOVERY MICRO-FORM                     */}
        {/* ======================================================== */}
        {viewMode === 'forgot_password' ? (
          <div className="bg-slate-900/95 backdrop-blur-xl border border-slate-800 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-2xl animate-in fade-in duration-200">
            <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <KeyRound className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-white leading-tight">
                    Recuperar Senha
                  </h2>
                  <p className="text-[10px] text-slate-400">Redefinição rápida por e-mail</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setViewMode('login');
                  setResetError('');
                  setResetSuccess(false);
                }}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                title="Voltar ao login"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            </div>

            {resetError && (
              <div className="mb-3 p-2.5 rounded-xl bg-red-950/60 border border-red-800 text-red-300 text-xs flex items-start gap-2 animate-in fade-in">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{resetError}</span>
              </div>
            )}

            {resetSuccess ? (
              <div className="space-y-3 py-1 animate-in fade-in">
                <div className="p-3.5 rounded-2xl bg-emerald-950/60 border border-emerald-500/50 text-emerald-200 text-xs space-y-1.5">
                  <div className="flex items-center gap-2 font-bold text-emerald-400 text-xs sm:text-sm">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>Link Enviado com Sucesso!</span>
                  </div>
                  <p className="text-slate-300 leading-relaxed text-[11px]">
                    Enviamos as instruções para <b>{resetEmail.trim() || email.trim()}</b>. Abra o seu
                    e-mail e clique no link recebido para cadastrar sua nova senha.
                  </p>
                  <p className="text-[10px] text-slate-400 italic">
                    💡 Caso não localize na caixa de entrada, verifique a pasta de <b>Spam</b>.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setViewMode('login');
                    setResetSuccess(false);
                  }}
                  className="w-full bg-sky-600 hover:bg-sky-500 text-white font-bold py-2.5 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 text-xs"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Voltar para Realizar Login</span>
                </button>
              </div>
            ) : (
              <form onSubmit={handlePasswordReset} className="space-y-3">
                <p className="text-xs text-slate-300 leading-relaxed">
                  Digite seu e-mail cadastrado. Enviaremos instantaneamente um link seguro para você definir uma nova senha.
                </p>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1 uppercase tracking-wider">
                    E-mail Cadastrado *
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Mail className="w-4 h-4 text-slate-500" />
                    </div>
                    <input
                      type="email"
                      required
                      value={resetEmail || email}
                      onChange={(e) => setResetEmail(e.target.value)}
                      disabled={resetLoading}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-amber-500 transition-colors disabled:opacity-50"
                      autoFocus
                    />
                  </div>
                </div>

                <div className="pt-1 flex flex-col gap-2">
                  <button
                    type="submit"
                    disabled={resetLoading}
                    className="w-full bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 disabled:opacity-50 text-slate-950 font-black py-2.5 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 text-xs active:scale-98"
                  >
                    {resetLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Enviando Link...</span>
                      </>
                    ) : (
                      <>
                        <KeyRound className="w-4 h-4" />
                        <span>Enviar Link de Recuperação</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setViewMode('login');
                      setResetError('');
                    }}
                    className="w-full py-2 text-xs text-slate-400 hover:text-white rounded-xl hover:bg-slate-850 transition-colors text-center"
                  >
                    Cancelar e Voltar
                  </button>
                </div>
              </form>
            )}
          </div>
        ) : (
          /* ======================================================== */
          /* VIEW 2: LOGIN / REGISTER MAIN CARD                       */
          /* ======================================================== */
          <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-2xl animate-in fade-in duration-200">
            {/* Header / Mode Indicator */}
            <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2.5">
              <h2 className="text-base sm:text-lg font-bold text-white">
                {viewMode === 'login' ? 'Realizar Login' : 'Criar Conta Gratuita'}
              </h2>
              <span className="text-[10px] sm:text-[11px] font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2.5 py-0.5 rounded-full">
                {viewMode === 'login' ? 'Acesso' : '100% Gratuito'}
              </span>
            </div>

            {/* Error Message Alert */}
            {error && (
              <div className="mb-3 p-2.5 rounded-xl bg-red-950/60 border border-red-800 text-red-300 text-xs flex items-start gap-2 animate-in fade-in leading-relaxed">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Success Message Alert */}
            {success && (
              <div className="mb-3 p-2.5 rounded-xl bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs flex items-start gap-2 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{success}</span>
              </div>
            )}

            {/* Google Sign-In Button */}
            <div className="mb-3">
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={googleLoading || loading}
                className="w-full bg-white hover:bg-slate-100 text-slate-900 font-bold py-2.5 px-3 rounded-xl shadow-md transition-all flex items-center justify-center gap-2.5 text-xs sm:text-sm active:scale-98 disabled:opacity-60"
              >
                {googleLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-slate-800" />
                ) : (
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                )}
                <span>
                  {googleLoading
                    ? 'Conectando...'
                    : viewMode === 'login'
                    ? 'Entrar com Conta Google'
                    : 'Cadastrar com Conta Google'}
                </span>
              </button>

              <div className="relative flex items-center justify-center my-3">
                <div className="border-t border-slate-800 w-full" />
                <span className="bg-slate-900 px-2.5 text-[9px] uppercase font-bold text-slate-500 tracking-wider">
                  ou
                </span>
                <div className="border-t border-slate-800 w-full" />
              </div>
            </div>

            {/* Email/Password Form */}
            <form onSubmit={handleSubmit} className="space-y-3">
              {viewMode === 'register' && (
                <>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 mb-1 uppercase tracking-wider">
                      Nome Completo *
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <UserIcon className="w-4 h-4 text-slate-500" />
                      </div>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        disabled={loading}
                        required={viewMode === 'register'}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-sky-500 transition-colors disabled:opacity-50"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1 uppercase tracking-wider">
                        Empresa / Órgão
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Building2 className="w-4 h-4 text-slate-500" />
                        </div>
                        <input
                          type="text"
                          value={company}
                          onChange={(e) => setCompany(e.target.value)}
                          disabled={loading}
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500 transition-colors"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1 uppercase tracking-wider">
                        WhatsApp / Celular
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Phone className="w-4 h-4 text-slate-500" />
                        </div>
                        <input
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          disabled={loading}
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500 transition-colors"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 mb-1 uppercase tracking-wider">
                      Função Pretendida
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Briefcase className="w-4 h-4 text-slate-500" />
                      </div>
                      <select
                        value={requestedRole}
                        onChange={(e) => setRequestedRole(e.target.value as UserRole)}
                        disabled={loading}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-sky-500 transition-colors"
                      >
                        <option value="surveyor">Coletor de Campo (GPS, Mapas, Madeira)</option>
                        <option value="field_lead">Líder de Equipe (Gestão e Edição)</option>
                        <option value="auditor">Auditor (Visualização de Laudos)</option>
                      </select>
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1 uppercase tracking-wider">
                  E-mail de Acesso *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="w-4 h-4 text-slate-500" />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                    required
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-sky-500 transition-colors disabled:opacity-50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1 uppercase tracking-wider">
                  Senha de Acesso *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="w-4 h-4 text-slate-500" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    required
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-10 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-sky-500 transition-colors disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {/* Elegantly placed "Esqueceu a senha?" link under password field */}
                {viewMode === 'login' && (
                  <div className="flex justify-end mt-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setResetEmail(email);
                        setViewMode('forgot_password');
                        setError('');
                        setSuccess('');
                      }}
                      className="text-[11px] text-sky-400 hover:text-sky-300 font-semibold hover:underline transition-colors py-0.5"
                    >
                      Esqueceu a senha?
                    </button>
                  </div>
                )}
              </div>

              {/* Main Submit Button */}
              <button
                type="submit"
                disabled={loading || googleLoading}
                className="w-full bg-sky-600 hover:bg-sky-500 disabled:bg-sky-800 text-white font-bold py-2.5 sm:py-3 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 mt-3 text-xs sm:text-sm active:scale-98"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{viewMode === 'login' ? 'Autenticando...' : 'Enviando...'}</span>
                  </>
                ) : (
                  <>
                    <span>{viewMode === 'login' ? 'Realizar Login' : 'Criar Minha Conta Gratuita'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {/* Toggle between Login and Register */}
            <div className="mt-3.5 pt-3 border-t border-slate-800 text-center space-y-2.5">
              <button
                type="button"
                onClick={() => {
                  setViewMode(viewMode === 'login' ? 'register' : 'login');
                  setError('');
                  setSuccess('');
                }}
                className="text-xs font-semibold text-slate-400 hover:text-emerald-400 transition-colors"
              >
                {viewMode === 'login'
                  ? 'Não tem conta? Criar conta gratuita'
                  : 'Já possui cadastro? Realizar login'}
              </button>

              <PwaInstallButton variant="login" />
            </div>
          </div>
        )}

        {/* Footer info */}
        <div className="flex flex-col items-center justify-center gap-1.5 text-[10px] sm:text-[11px] text-slate-500 font-medium text-center">
          <button
            type="button"
            onClick={() => setIsPoliciesOpen(true)}
            className="text-slate-400 hover:text-emerald-400 transition-colors underline cursor-pointer text-[10px]"
          >
            Termos de Uso e Política de Privacidade (LGPD)
          </button>
          <div className="flex items-center gap-1.5 text-slate-500">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>GoField Pro • AM TST SAÚDE E SEGURANÇA DO TRABALHO</span>
          </div>
        </div>
      </div>

      <LegalPoliciesModal isOpen={isPoliciesOpen} onClose={() => setIsPoliciesOpen(false)} />
    </div>
  );
};
