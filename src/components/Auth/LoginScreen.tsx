import React, { useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
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
  Loader2
} from 'lucide-react';

export const LoginScreen: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [company, setCompany] = useState('');
  const [phone, setPhone] = useState('');
  const [requestedRole, setRequestedRole] = useState<UserRole>('surveyor');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!email || !password) {
      setError('Por favor, preencha o e-mail e a senha.');
      return;
    }

    if (!isLogin && !name.trim()) {
      setError('Por favor, informe seu Nome Completo para identificação da equipe.');
      return;
    }

    setLoading(true);

    try {
      if (isLogin) {
        setSuccess('Autenticando... Preparando mapas e dados...');
        await signInWithEmailAndPassword(auth, email.trim(), password);
      } else {
        const userCred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        const currentUser = userCred.user;

        // Update display name in Firebase Auth
        await updateProfile(currentUser, {
          displayName: name.trim(),
        });

        const isOwner = currentUser.email?.toLowerCase() === 'alexandre1604981@gmail.com';

        // Explicitly write profile to Firestore so admin gets instant notification
        const userDocRef = doc(db, 'users', currentUser.uid);
        await setDoc(userDocRef, {
          uid: currentUser.uid,
          email: currentUser.email?.trim() || '',
          name: name.trim(),
          company: company.trim() || 'AM TST SAÚDE E SEGURANÇA DO TRABALHO',
          phone: phone.trim(),
          requestedRole: requestedRole,
          role: isOwner ? 'super_admin' : requestedRole,
          status: isOwner ? 'active' : 'pending',
          avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name.trim())}&background=0284c7&color=fff`,
          createdAt: new Date().toISOString(),
        }, { merge: true });

        setSuccess('Cadastro realizado! Sua solicitação foi enviada para liberação do Administrador.');
        await new Promise(resolve => setTimeout(resolve, 1200));
      }
    } catch (err: any) {
      let errorMessage = err.message || 'Erro ao autenticar. Verifique suas credenciais.';
      
      if (err.code === 'auth/email-already-in-use') {
        errorMessage = 'Este e-mail já está cadastrado. Tente fazer login.';
      } else if (err.code === 'auth/invalid-email') {
        errorMessage = 'O formato do e-mail é inválido.';
      } else if (err.code === 'auth/weak-password') {
        errorMessage = 'A senha é muito fraca. Digite pelo menos 6 caracteres.';
      } else if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        errorMessage = 'E-mail ou senha incorretos.';
      } else if (err.code === 'auth/operation-not-allowed') {
        errorMessage = 'O login por e-mail e senha não está habilitado no servidor.';
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-3 sm:p-6 relative overflow-hidden py-10">
      {/* Background decorations */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-sky-900/20 blur-[120px]"></div>
        <div className="absolute top-[60%] -right-[10%] w-[40%] h-[50%] rounded-full bg-emerald-900/20 blur-[120px]"></div>
      </div>

      <div className="w-full max-w-md z-10 space-y-4">
        <div className="flex flex-col items-center">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-sky-500 to-emerald-500 flex items-center justify-center text-white shadow-2xl mb-3">
            <Map className="w-7 h-7 sm:w-8 sm:h-8" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">GoField <span className="text-sky-400">Pro</span></h1>
          <p className="text-slate-400 mt-1 text-center text-xs">Navegação GPS e Mapas de Campo Georreferenciados</p>
        </div>

        <div className="bg-slate-900/85 backdrop-blur-xl border border-slate-800 rounded-3xl p-5 sm:p-7 shadow-2xl">
          <div className="flex items-center justify-between mb-5 border-b border-slate-800 pb-3">
            <h2 className="text-lg font-bold text-white">
              {isLogin ? 'Entrar no Sistema' : 'Solicitar Cadastro de Acesso'}
            </h2>
            <span className="text-[11px] font-semibold text-sky-400 bg-sky-950/60 border border-sky-800/60 px-2.5 py-0.5 rounded-full">
              {isLogin ? 'Login' : 'Novo Usuário'}
            </span>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-950/60 border border-red-800 text-red-300 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{success}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {!isLogin && (
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
                      required={!isLogin}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500 transition-colors disabled:opacity-50"
                      placeholder="Ex: Seu Nome Completo"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-3 py-2.5 text-xs text-white focus:outline-none focus:border-sky-500 transition-colors"
                        placeholder="Ex: AM TST Engenharia"
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
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-3 py-2.5 text-xs text-white focus:outline-none focus:border-sky-500 transition-colors"
                        placeholder="(00) 00000-0000"
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
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500 transition-colors"
                    >
                      <option value="surveyor">Coletor de Campo (GPS, Trilhas, Alfinetes)</option>
                      <option value="field_lead">Líder de Equipe (Gestão e Edição)</option>
                      <option value="auditor">Auditor (Visualização de Mapas e Relatórios)</option>
                    </select>
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1 uppercase tracking-wider">
                E-mail Corporativo *
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
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500 transition-colors disabled:opacity-50"
                  placeholder="usuario@empresa.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1 uppercase tracking-wider">
                Senha Segura *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="w-4 h-4 text-slate-500" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  required
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-12 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500 transition-colors disabled:opacity-50"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-sky-600 hover:bg-sky-500 disabled:bg-sky-800 text-white font-bold py-3 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 mt-5 text-sm"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{isLogin ? 'Autenticando...' : 'Enviando Solicitação...'}</span>
                </>
              ) : (
                <>
                  <span>{isLogin ? 'Entrar no Sistema' : 'Solicitar Liberação de Acesso'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-5 pt-5 border-t border-slate-800 text-center space-y-3.5">
            <button
              type="button"
              onClick={() => {
                setIsLogin(!isLogin);
                setError('');
                setSuccess('');
              }}
              className="text-xs font-semibold text-slate-400 hover:text-sky-400 transition-colors"
            >
              {isLogin ? 'Não tem acesso ainda? Solicitar cadastro' : 'Já possui cadastro aprovado? Fazer login'}
            </button>

            <PwaInstallButton variant="login" />
          </div>
        </div>

        <div className="flex flex-col items-center justify-center gap-1 text-[11px] text-slate-500 font-medium text-center">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>GoField Pro • AM TST SAÚDE E SEGURANÇA DO TRABALHO</span>
          </div>
        </div>
      </div>
    </div>
  );
};

